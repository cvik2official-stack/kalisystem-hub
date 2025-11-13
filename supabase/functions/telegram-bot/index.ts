// @formatter:off
// FIX: Pin the version for the Deno types reference to ensure stability and resolve 'Cannot find name Deno' errors.
/// <reference types="https://esm.sh/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

// The main function that handles incoming requests.
serve(async (req)=>{
  // 1. Acknowledge the request from Telegram immediately to avoid timeouts.
  const ack = new Promise((resolve)=>{
    setTimeout(()=>{
      resolve(new Response(null, {
        status: 200
      }));
    }, 0);
  });
  // Start processing the request payload asynchronously after we've scheduled the acknowledgement.
  processRequest(req).catch((e)=>console.error("Error processing request:", e));
  // Return the acknowledgement promise.
  return await ack;
});

/**
 * Parses and processes the incoming webhook request from Telegram.
 * @param req The incoming request object.
 */
async function processRequest(req: Request) {
  if (req.method !== 'POST') {
    return;
  }
  try {
    const payload = await req.json();
    
    if (payload.callback_query) {
      await handleCallbackQuery(payload.callback_query);
    } else if (payload.message) {
      await handleMessage(payload.message);
    }

  } catch (e) {
    console.error('Failed to parse or process webhook payload:', e);
  }
}

/**
 * Handles logic for incoming text messages.
 * @param message The message object from the Telegram payload.
 */
async function handleMessage(message: any) {
    if (message.text && message.text === '/whoami') {
        const { chat, from } = message;
        
        const responseText = `
*Who Am I?*
- *Chat ID:* \`${chat.id}\`
- *User ID:* \`${from.id}\`
- *Name:* ${from.first_name}${from.last_name ? ` ${from.last_name}` : ''}
- *Username:* ${from.username ? `@${from.username}` : 'Not set'}
        `.trim();

        await sendMessageToChat(chat.id, responseText, 'Markdown');
    }
}


/**
 * Handles logic for callback queries (button clicks).
 * @param query The callback_query object from the Telegram payload.
 */
async function handleCallbackQuery(query: any) {
  const data = query.data; // e.g., "approve_order_uuid-goes-here"
  const chatId = query.message.chat.id;
  if (!data || typeof data !== 'string') {
    return;
  }
  
  const parts = data.split('_');
  const orderId = parts.pop();
  const action = parts.join('_');
  
  if (action === 'approve_order' && orderId) {
    await handleApproveOrder(query, orderId, chatId);
  }
}

/**
 * Updates an order in the database to mark it as acknowledged.
 * @param query The full callback_query object from Telegram.
 * @param orderId The UUID of the order to update.
 * @param chatId The chat ID where the button was clicked.
 */
async function handleApproveOrder(query: any, orderId: string, chatId: number) {
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        }
      }
    });
    
    const { data, error } = await supabaseClient.from('orders').update({
      is_acknowledged: true
    }).eq('id', orderId).select().single();
    
    if (error) {
      console.error(`Failed to update order ${orderId}:`, error);
      await answerCallbackQuery(query.id, "Error: Could not find or update order.", true);
      return;
    }
    if (data) {
      console.log(`Order ${orderId} successfully acknowledged.`);
      await answerCallbackQuery(query.id, `Order ${data.order_id} Acknowledged!`, false);
    }
  } catch (e) {
    console.error('An unexpected error occurred in handleApproveOrder:', e);
    await answerCallbackQuery(query.id, "An internal error occurred.", true);
  }
}

/**
 * Sends a response to a callback query, showing a notification to the user in Telegram.
 * @param callbackQueryId The ID of the callback query to answer.
 * @param text The text of the notification.
 * @param showAlert Whether to show the notification as a modal alert.
 */
async function answerCallbackQuery(callbackQueryId: string, text: string, showAlert = false) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: showAlert
    })
  });
}

/**
 * Sends a text message to a specified Telegram chat.
 * @param chatId The ID of the chat to send the message to.
 * @param text The message content.
 * @param parseMode Optional parse mode (e.g., 'Markdown', 'HTML').
 */
async function sendMessageToChat(chatId: number, text: string, parseMode?: string) {
    if (!TELEGRAM_BOT_TOKEN) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: parseMode,
        }),
    });
}
