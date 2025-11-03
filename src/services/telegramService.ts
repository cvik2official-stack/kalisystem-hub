import { Order, OrderItem } from '../types';
import { generateOrderMessage } from '../utils/messageFormatter';

interface ReplyMarkup {
  inline_keyboard: { text: string; callback_data: string; }[][];
}

const escapeHtml = (text: string): string => {
    if (typeof text !== 'string') return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

/**
 * A helper function to send a message via the Telegram Bot API.
 * @param token The Telegram Bot Token.
 * @param chatId The chat ID to send the message to.
 * @param message The message text, formatted with HTML.
 * @param replyMarkup Optional inline keyboard markup.
 */
async function sendMessage(token: string, chatId: string, message: string, replyMarkup?: ReplyMarkup): Promise<void> {
    const TELEGRAM_API_URL = `https://api.telegram.org/bot${token}`;
    
    const body: { [key: string]: any } = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
    };

    if (replyMarkup) {
        body.reply_markup = replyMarkup;
    }

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Telegram API error:', errorData);
        throw new Error(errorData.description || 'Failed to send message via Telegram.');
    }
}

/**
 * Sends a formatted order message to a specific supplier's chat with interactive buttons.
 * @param order The order object.
 * @param chatId The supplier's Telegram chat ID.
 * @param message The pre-formatted order message (HTML).
 * @param token The Telegram Bot Token.
 */
export const sendOrderToSupplierOnTelegram = async (
  order: Order,
  chatId: string,
  message: string,
  token: string
): Promise<void> => {
    // FIX: Destructure the order ID immediately to prevent issues with malformed order objects.
    // This resolves the "Order undefined not found" error by ensuring the callback_data
    // is always constructed with a valid ID, or fails gracefully if the ID is missing.
    const { id: orderId } = order;
    if (!orderId) {
        console.error("sendOrderToSupplierOnTelegram was called with an order that has no ID.", order);
        throw new Error("Cannot send order to Telegram: Order is missing its ID.");
    }
    
    const replyMarkup: ReplyMarkup = {
        inline_keyboard: [
            [
                { text: "📎 Attach Invoice", callback_data: `invoice_attach_${orderId}` },
                { text: "❗️ Missing Item", callback_data: `missing_item_${orderId}` }
            ]
        ]
    };
    await sendMessage(token, chatId, message, replyMarkup);
};

/**
 * Sends a message to a supplier with items that were added to an existing order.
 * This message will only contain a "Missing Item" button, not an "Attach Invoice" button.
 * @param order The order that was updated.
 * @param newItems The list of newly added items.
 * @param chatId The supplier's Telegram chat ID.
 * @param token The Telegram Bot Token.
 */
export const sendOrderUpdateToSupplierOnTelegram = async (
    order: Order,
    newItems: OrderItem[],
    chatId: string,
    token: string
  ): Promise<void> => {
    const itemsList = newItems
      .map(item => `  - ${escapeHtml(item.name)} x${item.quantity}${item.unit ? ` ${escapeHtml(item.unit)}` : ''}`)
      .join('\n');
  
    const message = `
➕ <b>Additional Items for Order <code>${escapeHtml(order.orderId)}</code></b>
Please add the following items to the order:
${itemsList}
    `.trim();

    const replyMarkup: ReplyMarkup = {
        inline_keyboard: [
            [
                { text: "❗️ Missing Item", callback_data: `missing_item_${order.id}` }
            ]
        ]
    };
  
    await sendMessage(token, chatId, message, replyMarkup);
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