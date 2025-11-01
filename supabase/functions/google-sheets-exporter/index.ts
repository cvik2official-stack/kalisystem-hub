
// This function has been disabled and its logic moved to the client-side
// in src/services/googleSheetsService.ts to resolve deployment and CORS issues.

/*
// supabase/functions/google-sheets-exporter/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { google } from 'npm:googleapis@105'

// Define types for incoming payload
type ExportType = 'CRM_SUMMARY' | 'STOCK_REPORT';

interface ExportPayload {
  spreadsheetId: string;
  data: Record<string, any>[];
  sheetName: string;
  type: ExportType;
}

// Get credentials from environment variables
const SERVICE_ACCOUNT_CREDS_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS');
if (!SERVICE_ACCOUNT_CREDS_JSON) {
  throw new Error("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS environment variable not set.");
}
const SERVICE_ACCOUNT_CREDS = JSON.parse(SERVICE_ACCOUNT_CREDS_JSON);

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Main request handler
serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { spreadsheetId, data, sheetName, type }: ExportPayload = await req.json();

    // Authenticate and get Google Sheets API client
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: SERVICE_ACCOUNT_CREDS.client_email,
        private_key: SERVICE_ACCOUNT_CREDS.private_key,
      },
      scopes: SCOPES,
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // --- 1. Ensure sheet exists ---
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets?.some(s => s.properties?.title === sheetName);

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
    }

    // --- 2. Prepare data for the sheet ---
    let headers: string[];
    let values: (string | number)[][];

    if (type === 'CRM_SUMMARY') {
        headers = ["Date", "Store", "Supplier", "Payment Method", "Order ID"];
        values = data.map(row => [
            sheetName, // The date is passed as sheetName
            row.store || 'N/A',
            row.supplier || 'N/A',
            row.paymentMethod || 'N/A',
            row.orderId || 'N/A'
        ]);
    } else if (type === 'STOCK_REPORT') {
        headers = ["Date", "Store", "Item Name", "Quantity Used"];
        values = data.map(row => [
            sheetName, // The date is passed as sheetName
            row.store || 'N/A',
            row.name || 'N/A',
            row.totalQuantity || 0
        ]);
    } else {
        throw new Error(`Unknown report type: ${type}`);
    }

    // --- 3. Clear the sheet and write new data ---
    // Clear existing data in the sheet to prevent duplicates from previous runs
    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: sheetName,
    });
    
    // Write headers and new data
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [headers, ...values],
        },
    });

    return new Response(JSON.stringify({ success: true, message: `Sheet '${sheetName}' updated successfully.` }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
      status: 200,
    });

  } catch (err) {
    console.error("Error exporting to Google Sheets:", err);
    return new Response(JSON.stringify({ error: err.message || 'An unknown error occurred.' }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
      status: 500,
    });
  }
});
*/
