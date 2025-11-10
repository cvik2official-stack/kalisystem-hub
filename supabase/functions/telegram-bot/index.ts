// @formatter:off
// FIX: Use a versioned URL for Supabase edge runtime types to improve stability and resolve type loading issues. This directive provides the necessary Deno types for the function.
/// <reference types="https://esm.sh/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />
// @formatter:on
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

// The main function that handles incoming requests.
serve(async (req) => {
  // 1. Acknowledge the request from Telegram immediately to avoid timeouts.
  // This is the most critical part of a stable webhook.
  const ack = new Promise((resolve) => {
    setTimeout(() => {
      resolve(new Response(null, { status: 200 }));
    }, 0);
  });

  // Start processing the request payload asynchronously after we've scheduled the acknowledgement.
  processRequest(req).catch(e => console.error("Error processing request:", e));

  // Return the acknowledgement promise. Deno Deploy will wait for this to resolve.
  return await ack;
});

/**
 * Parses and processes the incoming webhook request from Telegram.
 * @param req The incoming request object.
 */
async function processRequest(req: Request) {
  if (req.method !== 'POST') {
    // Telegram only sends POST requests.
    return;
  }

  try {
    const payload = await req.json();

    // Check if the payload is a callback_query (i.e., a button click).
    if (payload.callback_query) {
      await handleCallbackQuery(payload.callback_query);
    }
    // Other handlers (like for text messages, commands, etc.) can be added here in the future.

  } catch (e) {
    console.error('Failed to parse or process webhook payload:', e);
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

  // FIX: Correctly parse callback data where actions can contain underscores.
  // The last part is the ID, and everything before it is the action.
  const parts = data.split('_');
  const orderId = parts.pop();
  const action = parts.join('_');


  // FIX: Pass the full query object to the handler to resolve scope issues.
  if (action === 'approve_order' && orderId) {
    await handleApproveOrder(query, orderId, chatId);
  }
  // Other actions can be handled here with else-if blocks.
}

/**
 * Updates an order in the database to mark it as acknowledged.
 * @param query The full callback_query object from Telegram.
 * @param orderId The UUID of the order to update.
 * @param chatId The chat ID where the button was clicked (for potential feedback).
 */
// FIX: Update function signature to accept the `query` object to be used for sending feedback.
async function handleApproveOrder(query: any, orderId: string, chatId: number) {
  try {
    // Initialize the Supabase client. The credentials must be set as environment variables in your Supabase project.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` } } }
    );

    // Update the 'orders' table.
    const { data, error } = await supabaseClient
      .from('orders')
      .update({ is_acknowledged: true })
      .eq('id', orderId)
      .select()
      .single(); // Use single() to get the updated record back and check for existence.

    if (error) {
      // If the update fails (e.g., order ID doesn't exist), log the error.
      console.error(`Failed to update order ${orderId}:`, error);
      // Optionally, send an error message back to the user on Telegram.
      await answerCallbackQuery(query.id, "Error: Could not find or update order.", true);
      return;
    }

    if (data) {
      console.log(`Order ${orderId} successfully acknowledged.`);
      // Optionally, provide feedback to the user on Telegram by answering the callback query.
      // This can show a small notification at the top of their screen.
      await answerCallbackQuery(query.id, `Order ${data.order_id} Acknowledged!`, false);
    }

  } catch (e) {
    console.error('An unexpected error occurred in handleApproveOrder:', e);
    await answerCallbackQuery(query.id, "An internal error occurred.", true);
  }
}

/**
 * Sends a response to a callback query, which can show a notification to the user in Telegram.
 * @param callbackQueryId The ID of the callback query to answer.
 * @param text The text of the notification.
 * @param showAlert Whether to show the notification as a modal alert.
 */
async function answerCallbackQuery(callbackQueryId: string, text: string, showAlert: boolean = false) {
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