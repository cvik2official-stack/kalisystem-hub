import { OrderItem } from '../types';

interface SupabaseCredentials {
  url: string;
  key: string;
}

interface AppendToSheetPayload {
    spreadsheetId: string;
    sheetName: string;
    values: (string | number)[][];
}

export const appendToSheet = async (
    payload: AppendToSheetPayload,
    { url, key }: SupabaseCredentials
): Promise<void> => {
    const response = await fetch(`${url}/functions/v1/google-sheets-writer`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to write data to Google Sheet.');
    }
};
