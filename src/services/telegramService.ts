// This service is now a client for the Supabase Edge Function.
// It no longer handles tokens or API calls directly.

import { Order, SupplierName } from '../types';

interface SupabaseCredentials {
  url: string;
  key: string;
}

export const sendOrderToSupplierOnTelegram = async (
  supplierName: SupplierName,
  message: string,
  { url, key }: SupabaseCredentials
): Promise<void> => {
    const response = await fetch(`${url}/functions/v1/telegram-bot`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            endpoint: '/send-to-supplier',
            supplierName,
            message
        })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message to supplier.');
    }
};

export const sendOrderToStoreOnTelegram = async (
  order: Order,
  // Message is no longer needed from client, backend will generate it
  _message: string, 
  { url, key }: SupabaseCredentials
): Promise<void> => {
     const response = await fetch(`${url}/functions/v1/telegram-bot`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            endpoint: '/send-to-store',
            order
        })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message to store.');
    }
};
