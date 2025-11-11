import { Order, OrderItem, Supplier } from '../types';
import { generateOrderMessage, escapeHtml } from '../utils/messageFormatter';

interface ReplyMarkup {
  inline_keyboard: { text: string; callback_data: string; }[][];
}

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
        const errorText = await response.text();
        try {
            const errorData = JSON.parse(errorText);
            console.error('Telegram API error:', errorData);
            const description = (typeof errorData.description === 'string') ? errorData.description : JSON.stringify(errorData);
            throw new Error(description || 'Failed to send message via Telegram.');
        } catch (jsonError) {
            throw new Error(`Telegram API returned non-JSON error: ${errorText}`);
        }
    }
}

/**
 * Sends a formatted order message to a specific supplier's chat with interactive buttons.
 * @param order The order object.
 * @param supplier The supplier object, containing the chat ID and bot settings.
 * @param message The pre-formatted order message (HTML).
 * @param token The Telegram Bot Token.
 */
export const sendOrderToSupplierOnTelegram = async (
  order: Order,
  supplier: Supplier,
  message: string,
  token: string
): Promise<void> => {
    const { id: orderId } = order;
    if (!orderId) {
        console.error("sendOrderToSupplierOnTelegram was called with an order that has no ID.", order);
        throw new Error("Cannot send order to Telegram: Order is missing its ID.");
    }
    if (!supplier.chatId) {
        throw new Error("Supplier Chat ID is missing.");
    }

    const buttons: { text: string; callback_data: string }[] = [];
    const botSettings = supplier.botSettings;

    if (botSettings?.showAttachInvoice) {
        buttons.push({ text: "📎 Attach Invoice", callback_data: `invoice_attach_${orderId}` });
    }
    if (botSettings?.showMissingItems) {
        buttons.push({ text: "❗️ Missing Item", callback_data: `missing_item_${orderId}` });
    }
    if (botSettings?.showOkButton) {
        buttons.push({ text: "✅ OK", callback_data: `approve_order_${orderId}` });
    }
    if (botSettings?.showDriverOnWayButton) {
        buttons.push({ text: "🚚 Driver on the way", callback_data: `driver_onway_${orderId}` });
    }

    let replyMarkup: ReplyMarkup | undefined = undefined;

    if (buttons.length > 0) {
        // Arrange buttons in rows of max 2
        const keyboard: { text: string; callback_data: string; }[][] = [];
        for (let i = 0; i < buttons.length; i += 2) {
            keyboard.push(buttons.slice(i, i + 2));
        }
        replyMarkup = { inline_keyboard: keyboard };
    }
    
    await sendMessage(token, supplier.chatId, message, replyMarkup);
};

/**
 * Sends an automated reminder message to a supplier for an unacknowledged order.
 * @param order The pending order.
 * @param supplier The supplier to remind.
 * @param token The Telegram bot token.
 */
export const sendReminderToSupplier = async (
  order: Order,
  supplier: Supplier,
  token: string
): Promise<void> => {
  if (!supplier.chatId) {
    throw new Error("Supplier Chat ID is missing for reminder.");
  }

  const message = `⚠️ Dear manager, it seems you didn't see the order sent 45mn ago for ${escapeHtml(order.store)}. Press cancel if out of stock, press ok if you process with the order, thank you b.`;

  const replyMarkup: ReplyMarkup = {
    inline_keyboard: [[
      { text: "cancel order", callback_data: `cancel_order_${order.id}` },
      { text: "ok noted", callback_data: `ok_noted_${order.id}` }
    ]]
  };

  await sendMessage(token, supplier.chatId, message, replyMarkup);
};

/**
 * Sends a formatted text receipt to a supplier's chat.
 * @param order The completed order object.
 * @param supplier The supplier object containing the chat ID.
 * @param message The pre-formatted receipt message (HTML).
 * @param token The Telegram Bot Token.
 */
export const sendReceiptOnTelegram = async (
    order: Order,
    supplier: Supplier,
    message: string,
    token: string
): Promise<void> => {
    if (!supplier.chatId) {
        throw new Error("Supplier Chat ID is missing.");
    }
    // Simple message with no buttons
    await sendMessage(token, supplier.chatId, message);
};

/**
 * Sends a message to a supplier with items that were added to an existing order.
 * This message will only contain a "Missing Item" button, if enabled for the supplier.
 * @param order The order that was updated.
 * @param newItems The list of newly added items.
 * @param supplier The supplier object.
 * @param token The Telegram Bot Token.
 */
export const sendOrderUpdateToSupplierOnTelegram = async (
    order: Order,
    newItems: OrderItem[],
    supplier: Supplier,
    token: string
  ): Promise<void> => {
    const { id: orderId } = order;
    if (!orderId) {
        console.error("sendOrderUpdateToSupplierOnTelegram was called with an order that has no ID.", order);
        throw new Error("Cannot send order update to Telegram: Order is missing its ID.");
    }
    if (!supplier.chatId) {
        throw new Error("Supplier Chat ID is missing.");
    }

    const itemsList = newItems
      .map(item => `  - ${escapeHtml(item.name)} x${item.quantity}${item.unit ? ` ${escapeHtml(item.unit)}` : ''}`)
      .join('\n');
  
    const message = `
➕ <b>Additional Items for Order <code>${escapeHtml(order.orderId)}</code></b>
Please add the following items to the order:
${itemsList}
    `.trim();

    let replyMarkup: ReplyMarkup | undefined = undefined;
    if (supplier.botSettings?.showMissingItems) {
        replyMarkup = {
            inline_keyboard: [
                [{ text: "❗️ Missing Item", callback_data: `missing_item_${orderId}` }]
            ]
        };
    }
  
    await sendMessage(token, supplier.chatId, message, replyMarkup);
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

/**
 * Sends the consolidated Kali Unify Report to a specific Telegram channel.
 * @param message The pre-formatted report message.
 * @param token The Telegram Bot Token.
 */
export const sendKaliUnifyReport = async (
    message: string,
    token: string
): Promise<void> => {
    const KALI_UNIFY_CHAT_ID = "-1003065576801";

    // The unify report uses plain text, so we send it as HTML without any tags.
    // Buttons have been removed as per user request.
    await sendMessage(token, KALI_UNIFY_CHAT_ID, message);
};

/**
 * Sends the consolidated Kali "On the Way" report to a specific Telegram chat.
 * @param message The pre-formatted report message (HTML).
 * @param token The Telegram Bot Token.
 */
export const sendKaliZapReport = async (
    message: string,
    token: string
): Promise<void> => {
    const KALI_ZAP_CHAT_ID = "5186573916";
    // Send a simple HTML message with no buttons
    await sendMessage(token, KALI_ZAP_CHAT_ID, message);
};

/**
 * Sends a formatted text receipt to a store's chat.
 * @param storeChatId The store's Telegram chat ID.
 * @param message The pre-formatted receipt message (HTML).
 * @param token The Telegram Bot Token.
 */
export const sendReceiptToStoreOnTelegram = async (
    storeChatId: string,
    message: string,
    token: string
): Promise<void> => {
    // Simple message with no buttons
    await sendMessage(token, storeChatId, message);
};

/**
 * Sends the daily Due Report to a specific Telegram channel.
 * @param message The pre-formatted report message (HTML).
 * @param token The Telegram Bot Token.
 */
export const sendDueReport = async (
    message: string,
    token: string
): Promise<void> => {
    // Re-using the same channel as the other main financial report.
    const DUE_REPORT_CHAT_ID = "-1003065576801";
    await sendMessage(token, DUE_REPORT_CHAT_ID, message);
};

/**
 * Sends the consolidated receipt to a store's Telegram chat.
 * @param storeChatId The store's Telegram chat ID.
 * @param message The pre-formatted receipt message.
 * @param token The Telegram Bot Token.
 */
export const sendConsolidatedReceiptToStore = async (
    storeChatId: string,
    message: string,
    token: string
): Promise<void> => {
    // Plain text message, send without <pre> tags for consistent formatting.
    await sendMessage(token, storeChatId, message);
};


/**
 * Sets the webhook for the Telegram bot.
 * @param webhookUrl The URL of the Supabase Edge Function.
 * @param token The Telegram Bot Token.
 */
export const setWebhook = async (webhookUrl: string, token: string): Promise<void> => {
    const TELEGRAM_API_URL = `https://api.telegram.org/bot${token}`;
    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);

    if (!response.ok) {
        const errorText = await response.text();
        try {
            const errorData = JSON.parse(errorText);
            console.error('Telegram API error:', errorData);
            const description = (typeof errorData.description === 'string') ? errorData.description : JSON.stringify(errorData);
            throw new Error(description || 'Failed to set webhook.');
        } catch (jsonError) {
            throw new Error(`Telegram API returned non-JSON error: ${errorText}`);
        }
    }
};
