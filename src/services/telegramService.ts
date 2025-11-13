import { Order, Supplier } from '../types';

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

const callTelegramApi = async (token: string, methodName: string, payload: any) => {
    const response = await fetch(`${TELEGRAM_API_BASE}${token}/${methodName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!data.ok) {
        throw new Error(`Telegram API Error: ${data.description}`);
    }
    return data.result;
};

export const sendOrderToSupplierOnTelegram = async (order: Order, supplier: Supplier, message: string, token: string): Promise<void> => {
    if (!supplier.chatId) {
        throw new Error('Supplier does not have a Chat ID configured.');
    }

    const payload: any = {
        chat_id: supplier.chatId,
        text: message,
        parse_mode: 'HTML',
    };

    if (supplier.botSettings?.showOkButton) {
        payload.reply_markup = {
            inline_keyboard: [
                [{ text: 'OK 👍', callback_data: `ack_order_${order.id}` }]
            ]
        };
    }

    await callTelegramApi(token, 'sendMessage', payload);
};

export const sendReminderToSupplier = async (order: Order, supplier: Supplier, token: string): Promise<void> => {
    if (!supplier.chatId) return;

    const reminderMessage = supplier.botSettings?.reminderMessageTemplate
        ? supplier.botSettings.reminderMessageTemplate.replace('{{orderId}}', order.orderId)
        : `🔔 Reminder: Please acknowledge order #${order.orderId}.`;

    const payload = {
        chat_id: supplier.chatId,
        text: reminderMessage,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: 'OK 👍', callback_data: `ack_order_${order.id}` }]
            ]
        }
    };
    await callTelegramApi(token, 'sendMessage', payload);
};

export const setWebhook = async (url: string, token: string): Promise<void> => {
    const payload = { url };
    await callTelegramApi(token, 'setWebhook', payload);
};

const KALI_CHAT_ID = '-4233405342';
const KALI_ZAP_CHAT_ID = '-1002242171549';
const DISPATCH_CHAT_ID = '-4233405342';

export const sendKaliUnifyReport = async (message: string, token: string): Promise<void> => {
    await callTelegramApi(token, 'sendMessage', {
        chat_id: KALI_CHAT_ID,
        text: message,
    });
};

export const sendKaliZapReport = async (message: string, token: string): Promise<void> => {
    await callTelegramApi(token, 'sendMessage', {
        chat_id: KALI_ZAP_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
    });
};

export const sendDueReport = async (message: string, token: string): Promise<void> => {
    await callTelegramApi(token, 'sendMessage', {
        chat_id: DISPATCH_CHAT_ID,
        text: message,
    });
};

export const sendConsolidatedReceiptToStore = async (chatId: string, message: string, token: string): Promise<void> => {
    await callTelegramApi(token, 'sendMessage', {
        chat_id: chatId,
        text: message,
    });
};
