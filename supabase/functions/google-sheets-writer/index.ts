// FIX: Switched from esm.sh to unpkg.com for the Supabase functions type definitions to resolve the "Cannot find type definition file" error.
/// <reference types="https://unpkg.com/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

/**
 * Creates a JWT, exchanges it for a Google Cloud access token.
 */
async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
    const scope = "https://www.googleapis.com/auth/spreadsheets";
    const aud = "https://oauth2.googleapis.com/token";

    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: serviceAccount.client_email,
        scope: scope,
        aud: aud,
        exp: now + 3600, // Expires in 1 hour
        iat: now,
    };
    
    const toBase64Url = (data: string) => btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const unsignedToken = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;

    const privateKeyData = serviceAccount.private_key
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\n/g, "");
    const privateKeyBuffer = Uint8Array.from(atob(privateKeyData), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        privateKeyBuffer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        new TextEncoder().encode(unsignedToken)
    );
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const jwt = `${unsignedToken}.${signature}`;

    const tokenResponse = await fetch(aud, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
        }),
    });

    if (!tokenResponse.ok) {
        throw new Error(`Failed to fetch access token: ${await tokenResponse.text()}`);
    }
    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, origin, x-requested-with',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    if (!serviceAccountJson) {
      throw new Error("Google Service Account JSON not configured in Supabase secrets.");
    }

    const { spreadsheetId, sheetName, values } = await req.json();
    if (!spreadsheetId || !sheetName || !values) {
        throw new Error("Missing required parameters: spreadsheetId, sheetName, or values.");
    }

    const accessToken = await getAccessToken(JSON.parse(serviceAccountJson));
    const sheetsApiBase = "https://sheets.googleapis.com/v4/spreadsheets";
    const authHeaders = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    };

    const getSheetResponse = await fetch(`${sheetsApiBase}/${spreadsheetId}?fields=sheets.properties.title`, { headers: authHeaders });
    if (!getSheetResponse.ok) throw new Error(`Failed to get spreadsheet details: ${await getSheetResponse.text()}`);
    const spreadsheet = await getSheetResponse.json();
    const sheetExists = spreadsheet.sheets?.some((s: any) => s.properties?.title === sheetName);

    if (!sheetExists) {
        const createSheetResponse = await fetch(`${sheetsApiBase}/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                requests: [{ addSheet: { properties: { title: sheetName } } }],
            }),
        });
        if (!createSheetResponse.ok) throw new Error(`Failed to create sheet: ${await createSheetResponse.text()}`);
    }

    const appendRange = encodeURIComponent(sheetName);
    const appendResponse = await fetch(`${sheetsApiBase}/${spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ values }),
    });

    if (!appendResponse.ok) throw new Error(`Failed to append data: ${await appendResponse.text()}`);

    return new Response(JSON.stringify({ ok: true, message: `Data appended to sheet: ${sheetName}` }), { headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
