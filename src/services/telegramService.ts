// This service calls the Telegram Bot API directly from the client.
import { Order } from '../types';

/**
 * A helper function to send a message via the Telegram Bot API.
 * @param token The Telegram Bot Token.
 * @param chatId The chat ID to send the message to.
 * @param message The message text, formatted with HTML.
 */
async function sendMessage(token: string, chatId: string, message: string): Promise<void> {
    const TELEGRAM_API_URL = `https://api.telegram.org/bot${token}`;
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Telegram API error:', errorData);
        throw new Error(errorData.description || 'Failed to send message via Telegram.');
    }
}

/**
 * Sends a formatted order message to a specific supplier's chat.
 * @param chatId The supplier's Telegram chat ID.
 * @param message The pre-formatted order message (HTML).
 * @param token The Telegram Bot Token.
 */
export const sendOrderToSupplierOnTelegram = async (
  chatId: string,
  message: string,
  token: string
): Promise<void> => {
    await sendMessage(token, chatId, message);
};


/**
 * Sends a notification message to a store's chat when an order is on the way.
 * This function is not currently used in the UI but is available.
 * @param order The order that is on the way.
 * @param storeChatId The store's Telegram chat ID.
 * @param token The Telegram Bot Token.
 */
export const sendOrderToStoreOnTelegram = async (
  order: Order,
  storeChatId: string,
  token: string
): Promise<void> => {
    const APP_BASE_URL = window.location.origin;
    const managerUrl = `${APP_BASE_URL}/#/?view=manager&store=${order.store}`;
    const message = `
📦 <b>New Delivery</b>
A new order for <b>${order.supplierName}</b> is on its way to <b>${order.store}</b>.

Order ID: <code>${order.orderId}</code>
Items: ${order.items.length}

Please mark items as received or spoiled upon arrival.

<a href="${managerUrl}">View Order Details</a>
    `.trim();

    await sendMessage(token, storeChatId, message);
};
