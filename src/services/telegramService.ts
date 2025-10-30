import { Order, SupplierName } from '../types';

interface EdgeFunctionParams {
    url: string;
    key: string;
    payload: any;
}

const invokeTelegramBot = async ({ url, key, payload }: EdgeFunctionParams) => {
    const response = await fetch(`${url}/functions/v1/telegram-bot`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Edge function failed: ${errorText}`);
    }

    const data = await response.json();
    if (!data.ok) {
        throw new Error(`Telegram bot error: ${data.error || 'Unknown error'}`);
    }

    return data;
};

interface SendToSupplierParams {
    supplierName: SupplierName;
    message: string;
}

const SUPABASE_URL = 'https://expwmqozywxbhewaczju.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4cHdtcW96eXd4Ymhld2Fjemp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2Njc5MjksImV4cCI6MjA3NzI0MzkyOX0.Tf0g0yIZ3pd-OcNrmLEdozDt9eT7Fn0Mjlu8BHt1vyg';


export const sendOrderToSupplierOnTelegram = async ({ supplierName, message }: SendToSupplierParams): Promise<void> => {
    await invokeTelegramBot({
        url: SUPABASE_URL,
        key: SUPABASE_KEY,
        payload: {
            endpoint: '/send-to-supplier',
            supplierName,
            message,
        },
    });
};

interface SendToStoreParams {
    url: string;
    key: string;
    order: Order;
    message: string;
}

export const sendOrderToStoreOnTelegram = async ({ url, key, order, message }: SendToStoreParams): Promise<void> => {
    await invokeTelegramBot({
        url,
        key,
        payload: {
            endpoint: '/send-to-store',
            order,
            message,
        },
    });
};
