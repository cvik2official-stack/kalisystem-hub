import { Bot, GrammyError, HttpError, InlineKeyboard, webhookCallback } from 'grammy';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from 'https://esm.sh/@google/genai';

// Fix for TypeScript "Cannot find name 'Deno'" errors.
// This provides a global type declaration for the Deno runtime object when types are not automatically available.
declare const Deno: any;

// --- Type Definitions ---
interface Order {
  id: string;
  orderId: string;
  store: string;
  supplierName: string;
  items: { itemId: string; name: string; quantity: number; unit?: string }[];
}

interface Item {
  id: string;
  name: string;
}

interface ParsedItem {
  matchedItemId?: string;
  newItemName?: string;
  quantity: number;
  unit?: string;
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
const getOrderFromDb = async (orderId: string): Promise<Order | null> => {
  const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (error) {
    console.error(`Error fetching order ${orderId}:`, error);
    return null;
  }
  return data as Order;
};

const getSecretName = (name: string, type: 'store' | 'supplier'): string => {
    return `${name.toUpperCase().replace(/[^A-Z0-9]/g, '')}_CHAT_ID`;
};

// --- Gemini AI Parsing Function ---
const parseItemListWithGemini = async (text: string, existingItems: Item[]): Promise<ParsedItem[]> => {
    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
        throw new Error("Gemini API key (API_KEY) is not configured in secrets.");
    }
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
        You are an expert data parsing tool. Your task is to parse the user's text into a structured JSON array.
        Analyze the user's list and match each line against the provided "Existing Items Database".
        RULES:
        1. For each line, determine item name, quantity, and unit.
        2. If you find a match in the "Existing Items Database", use the 'matchedItemId' field.
        3. If no match, use 'newItemName' with a cleaned-up item name.
        4. Always extract 'quantity' as a number. Default to 1.
        5. If a unit is present, extract it to the 'unit' field.
        6. Your response MUST be a single, valid JSON array of objects. No extra text or markdown.
        EXISTING ITEMS DATABASE: ${JSON.stringify(existingItems.map(item => ({ id: item.id, name: item.name })))}
        USER'S LIST TO PARSE:
        ---
        ${text}
        ---
    `;

    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    let responseText = response.text?.trim() ?? '';

    if (!responseText) throw new Error("The AI model returned an empty response.");
    if (responseText.startsWith('```json')) responseText = responseText.substring(7, responseText.length - 3).trim();
    if (responseText.startsWith('{')) responseText = `[${responseText}]`;

    const parsedJson = JSON.parse(responseText);
    if (!Array.isArray(parsedJson)) throw new Error("AI response was not a valid JSON array.");
    
    return parsedJson.filter(item => item && typeof item.quantity === 'number') as ParsedItem[];
};


// --- Bot Callback Handlers ---
bot.callbackQuery(/^spoil_start:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const orderId = ctx.match[1];
  const order = await getOrderFromDb(orderId);
  if (!order) return ctx.reply("Error: Could not find the order.");
  const spoilKeyboard = new InlineKeyboard();
  order.items.forEach(item => spoilKeyboard.text(`◻️ ${item.name}`, `toggle_spoil:${orderId}:${item.itemId}:`).row());
  spoilKeyboard.text("✅ Done", `spoil_done:${orderId}:`);
  await ctx.editMessageText("Select missing/spoiled items, then press 'Done'.", { reply_markup: spoilKeyboard });
});

bot.callbackQuery(/^toggle_spoil:(.+):(.+):(.*)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [_, orderId, toggledItemId, currentSpoiledStr] = ctx.match;
  const currentlySpoiled = new Set(currentSpoiledStr ? currentSpoiledStr.split(',') : []);
  currentlySpoiled.has(toggledItemId) ? currentlySpoiled.delete(toggledItemId) : currentlySpoiled.add(toggledItemId);
  const order = await getOrderFromDb(orderId);
  if (!order) return;
  const newSpoiledSet = Array.from(currentlySpoiled).join(',');
  const spoilKeyboard = new InlineKeyboard();
  order.items.forEach(item => {
    const isSpoiled = currentlySpoiled.has(item.itemId);
    spoilKeyboard.text(`${isSpoiled ? '🔸' : '◻️'} ${item.name}`, `toggle_spoil:${orderId}:${item.itemId}:${newSpoiledSet}`).row();
  });
  spoilKeyboard.text("✅ Done", `spoil_done:${orderId}:${newSpoiledSet}`);
  await ctx.editMessageReplyMarkup({ reply_markup: spoilKeyboard });
});

bot.callbackQuery(/^spoil_done:(.+):(.*)$/, async (ctx) => {
  await ctx.answerCallbackQuery("Processing...");
  const [_, orderId, spoiledItemIdsStr] = ctx.match;
  const spoiledItemIds = new Set(spoiledItemIdsStr ? spoiledItemIdsStr.split(',') : []);
  const order = await getOrderFromDb(orderId);
  if (!order) return;
  const updatedItems = order.items.map(item => ({ ...item, isSpoiled: spoiledItemIds.has(item.itemId) }));
  await supabase.from('orders').update({ items: updatedItems, modified_at: new Date().toISOString() }).eq('id', orderId);
  if (adminChatId) await bot.api.sendMessage(adminChatId, `📦 Order ${order.orderId} for ${order.store} received with ${spoiledItemIds.size} spoiled item(s).`);
  await ctx.editMessageText("✅ Order received! Missing items will be re-ordered.");
});

bot.callbackQuery(/^received:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery("Processing...");
  const orderId = ctx.match[1];
  const order = await getOrderFromDb(orderId);
  if (!order) return;
  if (adminChatId) await bot.api.sendMessage(adminChatId, `📦 Order ${order.orderId} for ${order.store} received with no spoiled items.`);
  await ctx.editMessageText("✅ Order received!");
});


// --- Edge Function Main Handler ---
const handleUpdate = webhookCallback(bot, 'std/http');

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (url.pathname.endsWith('/bot')) {
    try { return await handleUpdate(req); } catch (err) { console.error(err); }
  }

  try {
    const { endpoint, ...payload } = await req.json();

    if (endpoint === '/send-to-supplier') {
        const secretName = getSecretName(payload.supplierName, 'supplier');
        const chatId = Deno.env.get(secretName);
        if (!chatId) throw new Error(`Chat ID for supplier ${payload.supplierName} not configured in secret ${secretName}.`);
        await bot.api.sendMessage(chatId, payload.message, { parse_mode: 'HTML' });
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (endpoint === '/send-to-store') {
        const order: Order = payload.order;
        if (!order || !order.store) {
          return new Response(JSON.stringify({ ok: false, error: "Order data with store name is required." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const secretName = getSecretName(order.store, 'store');
        const chatId = Deno.env.get(secretName);
        if (!chatId) throw new Error(`Chat ID for store ${order.store} not configured in secret ${secretName}.`);
        const inlineKeyboard = new InlineKeyboard().text('Spoil item', `spoil_start:${order.id}`).text('Received', `received:${order.id}`);
        await bot.api.sendMessage(chatId, payload.message, { parse_mode: 'HTML', reply_markup: inlineKeyboard });
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (endpoint === '/parse-with-ai') {
        const parsedItems = await parseItemListWithGemini(payload.text, payload.existingItems);
        return new Response(JSON.stringify({ ok: true, parsedItems }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(err);
    const errorResponse = err.message || "Internal Server Error";
    const status = err instanceof GrammyError ? (err.error_code || 500) : 500;
    return new Response(JSON.stringify({ ok: false, error: errorResponse }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});