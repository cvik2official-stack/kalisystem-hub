// This file now accesses KJUR from the global scope, as provided by the script in index.html
declare const KJUR: any;

type ExportType = 'CRM_SUMMARY' | 'STOCK_REPORT';

interface ExportPayload {
  spreadsheetId: string;
  data: Record<string, any>[];
  sheetName: string;
  type: ExportType;
}

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
}

// --- JWT and Auth ---
async function getAccessToken(creds: ServiceAccountCreds): Promise<string> {
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600, // Expires in 1 hour
        iat: now,
    };
    
    const signedJwt = KJUR.jws.JWS.sign(
        'RS256',
        JSON.stringify(header),
        JSON.stringify(payload),
        creds.private_key
    );

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: signedJwt,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to get access token from Google.');
    }
    const { access_token } = await response.json();
    return access_token;
}

// --- Sheets API Helpers ---
async function ensureSheetExists(spreadsheetId: string, sheetName: string, accessToken: string) {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('Could not fetch spreadsheet details.');
    const spreadsheet = await response.json();
    const sheetExists = spreadsheet.sheets?.some((s: any) => s.properties?.title === sheetName);

    if (!sheetExists) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                requests: [{ addSheet: { properties: { title: sheetName } } }],
            }),
        });
    }
}

async function clearAndWriteData(spreadsheetId: string, sheetName: string, values: (string | number)[][], accessToken: string) {
    // 1. Clear the sheet
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    // 2. Write new data
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
    });

    if (!response.ok) throw new Error('Failed to write data to Google Sheet.');
}

// --- Main Export Function ---
const callGoogleSheetsExporter = async (payload: ExportPayload, credentialsJson: string) => {
    let creds: ServiceAccountCreds;
    try {
        creds = JSON.parse(credentialsJson);
        if (!creds.client_email || !creds.private_key) {
            throw new Error('Credentials JSON is missing client_email or private_key.');
        }
    } catch (e) {
        throw new Error('Invalid Google API credentials JSON format.');
    }

    const accessToken = await getAccessToken(creds);

    await ensureSheetExists(payload.spreadsheetId, payload.sheetName, accessToken);

    let headers: string[];
    let values: (string | number)[][];
    if (payload.type === 'CRM_SUMMARY') {
        headers = ["Date", "Store", "Supplier", "Payment Method", "Order ID"];
        values = payload.data.map(row => [
            payload.sheetName,
            row.store || 'N/A',
            row.supplier || 'N/A',
            row.paymentMethod || 'N/A',
            row.orderId || 'N/A'
        ]);
    } else if (payload.type === 'STOCK_REPORT') {
        headers = ["Date", "Store", "Item Name", "Quantity Used"];
        values = payload.data.map(row => [
            payload.sheetName,
            row.store || 'N/A',
            row.name || 'N/A',
            row.totalQuantity || 0
        ]);
    } else {
        throw new Error(`Unknown report type: ${payload.type}`);
    }

    await clearAndWriteData(payload.spreadsheetId, payload.sheetName, [headers, ...values], accessToken);

    return { success: true, message: `Sheet '${payload.sheetName}' updated successfully.` };
};

export default callGoogleSheetsExporter;