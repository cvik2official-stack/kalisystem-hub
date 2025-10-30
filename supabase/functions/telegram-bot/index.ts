// FIX: The Deno types reference URL was invalid. Replaced with the correct lib reference for the Deno namespace.
/// <reference types="https://deno.land/x/deno/types.d.ts" />

import { Bot, GrammyError, HttpError, InlineKeyboard, webhookCallback } from 'grammy';
// FIX: Corrected the import URL for the Supabase client. It was missing the 'https://' protocol.
import { createClient, SupabaseClient } from 'https://deno.land/x/supabase_deno@v1.0.5/mod.ts';

interface Order {
  id: string;
  orderId: string;
  store: string;
  supplierName: string;
  items: { itemId: string; name: string; quantity: number; unit?: string }[];
}

// --- Supabase Client Initialization ---
const supabase: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}` } } }
);

// --- Telegram Bot Initialization ---
const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!botToken) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set in the environment.");
}
const bot = new Bot(botToken);
const adminChatId = Deno.env.get('ADMIN_CHAT_ID');

// --- Helper Functions ---
const escapeHtml = (text: string): string => {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const getOrderFromDb = async (orderId: string): Promise<Order | null> => {
  const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (error) {
    console.error(`Error fetching order ${orderId}:`, error);
    return null;
  }
  return data as Order;
};

// --- Bot Callback Handlers ---

// Manager clicks "Spoil item"
bot.callbackQuery(/^spoil_start:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const orderId = ctx.match[1];
  const order = await getOrderFromDb(orderId);

  if (!order) {
    return ctx.reply("Error: Could not find the order.");
  }

  const spoilKeyboard = new InlineKeyboard();
  order.items.forEach(item => {
    spoilKeyboard.text(`◻️ ${item.name}`, `toggle_spoil:${orderId}:${item.itemId}:`).row();
  });
  spoilKeyboard.text("✅ Done", `spoil_done:${orderId}:`);

  await ctx.editMessageText(
    "Select missing/spoiled items, then press 'Done' when finished.",
    { reply_markup: spoilKeyboard }
  );
});

// Manager toggles an item for spoiling
bot.callbackQuery(/^toggle_spoil:(.+):(.+):(.*)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const orderId = ctx.match[1];
  const toggledItemId = ctx.match[2];
  const currentlySpoiled = new Set(ctx.match[3] ? ctx.match[3].split(',') : []);

  if (currentlySpoiled.has(toggledItemId)) {
    currentlySpoiled.delete(toggledItemId);
  } else {
    currentlySpoiled.add(toggledItemId);
  }

  const order = await getOrderFromDb(orderId);
  if (!order) return;

  const newSpoiledSet = Array.from(currentlySpoiled).join(',');
  const spoilKeyboard = new InlineKeyboard();
  order.items.forEach(item => {
    const isSpoiled = currentlySpoiled.has(item.itemId);
    spoilKeyboard.text(
      `${isSpoiled ? '🔸' : '◻️'} ${item.name}`,
      `toggle_spoil:${orderId}:${item.itemId}:${newSpoiledSet}`
    ).row();
  });
  spoilKeyboard.text("✅ Done", `spoil_done:${orderId}:${newSpoiledSet}`);

  await ctx.editMessageReplyMarkup({ reply_markup: spoilKeyboard });
});


// Manager clicks "Done" after spoiling items
bot.callbackQuery(/^spoil_done:(.+):(.*)$/, async (ctx) => {
  await ctx.answerCallbackQuery("Processing spoiled items...");
  const orderId = ctx.match[1];
  const spoiledItemIds = new Set(ctx.match[2] ? ctx.match[2].split(',') : []);

  const order = await getOrderFromDb(orderId);
  if (!order) return;

  const updatedItems = order.items.map(item => ({
    ...item,
    isSpoiled: spoiledItemIds.has(item.itemId)
  }));
  
  // Update the order in Supabase with the spoiled flags
  const { error } = await supabase
    .from('orders')
    .update({ items: updatedItems, modified_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) {
    console.error("Error updating spoiled items:", error);
    await ctx.editMessageText("An error occurred while saving spoiled items.");
    return;
  }
  
  const notificationText = `📦 Order ${order.orderId} for ${order.store} marked as received with ${spoiledItemIds.size} spoiled item(s).`;
  if (adminChatId) {
    await bot.api.sendMessage(adminChatId, notificationText);
  }

  await ctx.editMessageText("✅ Order received! Missing items will be re-ordered automatically.");
});


// Manager clicks "Received"
bot.callbackQuery(/^received:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery("Processing...");
  const orderId = ctx.match[1];
  
  const order = await getOrderFromDb(orderId);
  if (!order) return;
  
  // No items are spoiled, so we just mark the order as received.
  // The frontend logic handles moving to 'completed'. Here, we just notify.
  const notificationText = `📦 Order ${order.orderId} for ${order.store} marked as received with no spoiled items.`;
  if (adminChatId) {
    await bot.api.sendMessage(adminChatId, notificationText);
  }

  await ctx.editMessageText("✅ Order received!");
});


// --- Edge Function Main Handler ---
const handleUpdate = webhookCallback(bot, 'std/http');

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Endpoint for Telegram to send webhook updates
  if (url.pathname.includes('/bot')) {
    try {
      return await handleUpdate(req);
    } catch (err) {
      console.error(err);
      return new Response("Error processing webhook", { status: 500 });
    }
  }

  // CORS preflight request handler
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { endpoint, ...payload } = await req.json();

    // Endpoint called from frontend to send message to a supplier
    if (endpoint === '/send-to-supplier') {
      await bot.api.sendMessage(payload.chatId, payload.message, { parse_mode: 'HTML' });
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    // Endpoint called from frontend to send message to a store
    if (endpoint === '/send-to-store') {
      const order: Order = payload.order;
      if (!order || !order.store) {
        throw new HttpError("Order data with store name is required.", 400);
      }
    
      // Derive the secret name from the store name
      const storeChatIdSecretName = `${order.store.toUpperCase()}_CHAT_ID`;
      const storeChatId = Deno.env.get(storeChatIdSecretName);
    
      if (!storeChatId) {
        throw new Error(`Chat ID for store ${order.store} is not configured in secrets as ${storeChatIdSecretName}.`);
      }

      const inlineKeyboard = new InlineKeyboard()
        .text('Spoil item', `spoil_start:${order.id}`)
        .text('Received', `received:${order.id}`);

      await bot.api.sendMessage(storeChatId, payload.message, {
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
      });
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  } catch (err) {
    console.error(err);
    const errorResponse = err instanceof GrammyError ? err.message : err.message || "Internal Server Error";
    // FIX: The `HttpError` from `grammy` has an `error_code` property, not `code`.
    return new Response(JSON.stringify({ ok: false, error: errorResponse }), { status: err instanceof HttpError ? err.error_code : 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
});