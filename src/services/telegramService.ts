import { Order } from '../types';

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
    url: string;
    key: string;
    chatId: string;
    message: string;
}

export const sendOrderToSupplierOnTelegram = async ({ url, key, chatId, message }: SendToSupplierParams): Promise<void> => {
    await invokeTelegramBot({
        url,
        key,
        payload: {
            endpoint: '/send-to-supplier',
            chatId,
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