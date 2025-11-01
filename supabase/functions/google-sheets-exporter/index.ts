// FIX: Updated the Supabase function types reference to a valid path to resolve the type definition error.
/// <reference types="npm:@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { google } from 'https://deno.land/x/google_sheets@v0.1.1/mod.ts';

// FIX: Added Deno type declaration to resolve 'Cannot find name Deno' error in some environments.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// These environment variables must be set in your Supabase project's secrets
// The GOOGLE_API_CREDENTIALS should be the JSON content of your service account key file
const serviceAccountCredentials = JSON.parse(Deno.env.get('GOOGLE_API_CREDENTIALS') || '{}');

const createSheetAndClear = async (sheets: any, spreadsheetId: string, sheetName: string) => {
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: { title: sheetName }
                    }
                }]
            }
        });
    } catch (e) {
        // Ignore "duplicate sheet name" error, which means the sheet already exists.
        if (!e.message.includes('duplicate sheet name')) {
            throw e;
        }
    }
    // Clear the sheet to ensure idempotency
    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: sheetName,
    });
};

const handleCrmSummary = async (sheets: any, spreadsheetId: string, sheetName: string, data: any[]) => {
    const header = ['Store', 'Supplier', 'Payment Method', 'Order Count'];
    
    // Create a pivot table from the raw data
    const pivot: Record<string, number> = {};
    data.forEach(row => {
        const key = `${row.store}|${row.supplier}|${row.paymentMethod}`;
        pivot[key] = (pivot[key] || 0) + 1;
    });

    const rows = Object.entries(pivot).map(([key, count]) => {
        const [store, supplier, paymentMethod] = key.split('|');
        return [store, supplier, paymentMethod, count];
    });

    // FIX: Cast sort keys to string to prevent 'localeCompare' on number type error.
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [header, ...rows],
        },
    });
};

const handleStockReport = async (sheets: any, spreadsheetId: string, sheetName: string, data: any[]) => {
    const header = ['Store', 'Item Name', 'Total Quantity'];
    
    // Data is already aggregated from the client, just format it
    const rows = data.map(item => [item.store, item.name, item.totalQuantity]);
    // FIX: Cast sort keys to string to prevent 'localeCompare' on number type error.
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [header, ...rows],
        },
    });
};


serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { spreadsheetId, data, sheetName, type } = await req.json();

    if (!spreadsheetId || !data || !sheetName || !type) {
      throw new Error("Missing required parameters: spreadsheetId, data, sheetName, and type are required.");
    }
    
    const sheets = google.sheets({
        version: 'v4',
        auth: new google.auth.GoogleAuth({
            credentials: {
                client_email: serviceAccountCredentials.client_email,
                private_key: serviceAccountCredentials.private_key,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        }),
    });

    await createSheetAndClear(sheets, spreadsheetId, sheetName);

    if (type === 'CRM_SUMMARY') {
        await handleCrmSummary(sheets, spreadsheetId, sheetName, data);
    } else if (type === 'STOCK_REPORT') {
        await handleStockReport(sheets, spreadsheetId, sheetName, data);
    } else {
        throw new Error(`Invalid report type: ${type}`);
    }

    return new Response(JSON.stringify({ success: true, message: `Sheet '${sheetName}' updated successfully.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});