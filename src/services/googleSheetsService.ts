interface SupabaseCredentials {
  url: string;
  key: string;
}

interface ExportPayload {
  spreadsheetId: string;
  data: any;
  sheetName: string;
  type: 'CRM_SUMMARY' | 'STOCK_REPORT';
}

const callGoogleSheetsExporter = async (payload: ExportPayload, { url, key }: SupabaseCredentials) => {
    const response = await fetch(`${url}/functions/v1/google-sheets-exporter`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to communicate with the export service.');
    }

    return response.json();
};

export default callGoogleSheetsExporter;
