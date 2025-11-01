// FIX: Switched from unpkg.com to cdn.jsdelivr.net for the Supabase functions type definitions to resolve the "Cannot find type definition file" error.
/// <reference types="https://cdn.jsdelivr.net/npm/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';

declare const Deno: {
  env: { get(key: string): string | undefined; };
};

// --- Interfaces & Types ---
interface OrderItem {
  quantity: number;
}
interface Order {
  id: string;
  store: string;
  items: OrderItem[];
  payment_method: string;
  completed_at: string;
}

// --- Environment Variables & Clients ---
const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SPREADSHEET_ID = '1CYA0GehEiLVhiSonIi_6hHQWg4VQ88_8hdrz8s_BFD8';

if (!serviceAccountJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set.");
if (!supabaseUrl) throw new Error("SUPABASE_URL is not set.");
if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const sheetsApiBase = "https://sheets.googleapis.com/v4/spreadsheets";

// --- Google Auth --- (Copied from google-sheets-writer)
// ... [getAccessToken function from google-sheets-writer]
async function getAccessToken(serviceAccount: { client_email: string, private_key: string }): Promise<string> {
    const scope = "https://www.googleapis.com/auth/spreadsheets";
    const aud = "https://oauth2.googleapis.com/token";
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = { iss: serviceAccount.client_email, scope, aud, exp: now + 3600, iat: now };
    const toBase64Url = (data: string) => btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const unsignedToken = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
    const privateKeyData = serviceAccount.private_key.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\n/g, "");
    const privateKeyBuffer = Uint8Array.from(atob(privateKeyData), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey("pkcs8", privateKeyBuffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    const signatureBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(unsignedToken));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const jwt = `${unsignedToken}.${signature}`;
    const tokenResponse = await fetch(aud, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    });
    if (!tokenResponse.ok) throw new Error(`Failed to fetch access token: ${await tokenResponse.text()}`);
    return (await tokenResponse.json()).access_token;
}

// --- Google Sheets Helpers ---
const getAuthHeaders = (accessToken: string) => ({ 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' });

async function ensureSheetExists(accessToken: string, sheetTitle: string) {
    const authHeaders = getAuthHeaders(accessToken);
    const response = await fetch(`${sheetsApiBase}/${SPREADSHEET_ID}?fields=sheets.properties.title`, { headers: authHeaders });
    if (!response.ok) throw new Error(`Failed to get spreadsheet details: ${await response.text()}`);
    const spreadsheet = await response.json();
    const sheetExists = spreadsheet.sheets?.some((s: any) => s.properties?.title === sheetTitle);

    if (!sheetExists) {
        const createResponse = await fetch(`${sheetsApiBase}/${SPREADSHEET_ID}:batchUpdate`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetTitle } } }] }),
        });
        if (!createResponse.ok) throw new Error(`Failed to create sheet: ${await createResponse.text()}`);
        
        // Add header row to the new sheet
        const header = [['Store', 'ABA', 'CASH', 'KALI', 'STOCK', 'PRODUCTION', 'Total']];
        await fetch(`${sheetsApiBase}/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}:append?valueInputOption=USER_ENTERED`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ values: header }),
        });
    }
}

async function updateStoreRow(accessToken: string, sheetTitle: string, storeName: string, rowData: (string | number)[]) {
    const authHeaders = getAuthHeaders(accessToken);
    const range = encodeURIComponent(sheetTitle);
    const getResponse = await fetch(`${sheetsApiBase}/${SPREADSHEET_ID}/values/${range}`, { headers: authHeaders });
    if (!getResponse.ok) throw new Error(`Failed to read sheet data: ${await getResponse.text()}`);
    const sheetData = await getResponse.json();
    const values: string[][] = sheetData.values || [];
    
    const storeRowIndex = values.findIndex(row => row[0] === storeName);

    if (storeRowIndex > -1) {
        // Update existing row
        const updateRange = `${sheetTitle}!A${storeRowIndex + 1}`;
        await fetch(`${sheetsApiBase}/${SPREADSHEET_ID}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify({ values: [rowData] }),
        });
    } else {
        // Append new row
        await fetch(`${sheetsApiBase}/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ values: [rowData] }),
        });
    }
}

// --- Main Logic ---
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { orderId } = await req.json();
    if (!orderId) throw new Error("Missing orderId.");

    // 1. Mark order as exported and get its details
    const exportedAt = new Date().toISOString();
    const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({ exported_to_crm_at: exportedAt })
        .eq('id', orderId)
        .select('id, store, exported_to_crm_at')
        .single();
    if (updateError) throw updateError;
    if (!updatedOrder) throw new Error("Order not found or could not be updated.");

    const storeName = updatedOrder.store;

    // 2. Calculate daily summary for that store
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const { data: dailyOrders, error: fetchError } = await supabase
        .from('orders')
        .select('items, payment_method')
        .eq('store', storeName)
        .eq('status', 'completed')
        .is('payment_method', true)
        .gte('completed_at', today.toISOString())
        .lt('completed_at', tomorrow.toISOString());

    if (fetchError) throw fetchError;
    
    const summary = { ABA: 0, CASH: 0, KALI: 0, STOCK: 0, PRODUCTION: 0 };
    for (const order of dailyOrders as Order[]) {
        const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
        if (order.payment_method && summary.hasOwnProperty(order.payment_method)) {
            summary[order.payment_method as keyof typeof summary] += totalItems;
        }
    }
    const grandTotal = Object.values(summary).reduce((sum, val) => sum + val, 0);

    // 3. Update Google Sheet
    const sheetTitle = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const accessToken = await getAccessToken(JSON.parse(serviceAccountJson!));
    await ensureSheetExists(accessToken, sheetTitle);
    
    const rowData = [
        storeName,
        summary.ABA,
        summary.CASH,
        summary.KALI,
        summary.STOCK,
        summary.PRODUCTION,
        grandTotal
    ];
    await updateStoreRow(accessToken, sheetTitle, storeName, rowData);

    return new Response(
      JSON.stringify({ ok: true, message: "Export successful.", updatedOrder }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});