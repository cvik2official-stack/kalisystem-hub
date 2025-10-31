// FIX: Replaced npm specifier with a direct URL to the type definition file to resolve "Cannot find type definition file" errors.
/// <reference types="https://esm.sh/@supabase/functions-js@2/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Gapi, GapiAuthenticator, a1 } from "https://deno.land/x/gapi@v0.3.4/mod.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, origin, x-requested-with',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  // Explicitly handle CORS preflight requests.
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

    const auth = new GapiAuthenticator({
        serviceAccount: JSON.parse(serviceAccountJson),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const gapi = new Gapi({ authenticator: auth });
    const sheets = gapi.sheets("v4");

    // 1. Check if the sheet for today already exists
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.sheets?.some(s => s.properties?.title === sheetName);

    // 2. If it doesn't exist, create it
    if (!sheetExists) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [{ addSheet: { properties: { title: sheetName } } }],
            },
        });
    }

    // 3. Append the data to the sheet
    const range = a1.fromSheet(sheetName); // a1 notation for the whole sheet
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: range.toString(),
        valueInputOption: "USER_ENTERED",
        resource: { values },
    });

    return new Response(JSON.stringify({ ok: true, message: `Data appended to sheet: ${sheetName}` }), { headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});