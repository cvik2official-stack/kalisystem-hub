// FIX: Switched the CDN for Supabase functions type definitions from esm.sh to jsdelivr to resolve a "Cannot find type definition file" error, which can be caused by CDN or tooling issues.
/// <reference types="https://cdn.jsdelivr.net/npm/@supabase/functions-js@2.4.1/dist/edge-runtime.d.ts" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// FIX: Switched from deno.land to a Deno-specific bundle from esm.sh to resolve deployment permission errors in Supabase.
import { Bot, webhookCallback, InlineKeyboard } from 'https://esm.sh/grammy@1.25.1?target=deno';
// FIX: Pin @supabase/supabase-js to a specific version for stability.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';

// FIX: Declare the Deno global type to resolve TypeScript errors when the Deno
// environment types are not automatically loaded by the editor. This resolves all `Cannot find name 'Deno'` errors.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Define types matching the frontend for consistency
interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  unit?: string;
  isSpoiled?: boolean;
}

interface Order {
  id: string;
  order_id: string; // Snake case from DB
  store: string;
  supplier_id: string;
  supplierName?: string; // This will be added for context
  items: OrderItem[];
  status: string;
  is_sent: boolean;
  is_received: boolean;
  created_at: string;
  modified_at: string;
  completed_at?: string;
}


// --- Environment Variables & Clients ---
const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!telegramBotToken) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
if (!supabaseUrl) throw new Error("SUPABASE_URL is not set.");
if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");

const bot = new Bot(telegramBotToken);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Helper Functions ---
const getChatId = (name: string): string | undefined => {
    if (!name) return undefined;
    const secretName = `${name.replace(/-/g, '_').toUpperCase()}_CHAT_ID`;
    return Deno.env.get(secretName);
};

const escapeHtml = (text: string): string => {
  if (typeof text !== 'string') return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const generateManagerMessage = (order: Order) => {
    const header = `<b>Order for ${escapeHtml(order.store)}</b>\nFrom: ${escapeHtml(order.supplierName || 'Unknown')}\n\nItems:`;
    const itemsList = order.items.map(item => {
        const status = item.isSpoiled ? '<i>(Spoiled)</i> ' : '';
        const unitText = item.unit ? ` ${escapeHtml(item.unit)}` : '';
        const strikeOpen = item.isSpoiled ? '<s>' : '';
        const strikeClose = item.isSpoiled ? '</s>' : '';
        return `${strikeOpen}${status}${escapeHtml(item.name)} x${item.quantity}${unitText}${strikeClose}`;
    }).join('\n');
    return `${header}\n${itemsList}`;
};

const generateManagerKeyboard = (order: Order, spoiledStateBitmask: bigint): InlineKeyboard => {
    const keyboard = new InlineKeyboard();
    order.items.forEach((item, index) => {
        const isSpoiled = (spoiledStateBitmask & (1n << BigInt(index))) !== 0n;
        const buttonText = isSpoiled ? `✅ Unspoil: ${item.name}` : `❌ Spoil: ${item.name}`;
        // 't' for toggle
        keyboard.text(buttonText, `t:${order.id}:${index}:${spoiledStateBitmask.toString()}`).row();
    });
    // 'c' for confirm
    keyboard.text('Done', `c:${order.id}:${spoiledStateBitmask.toString()}`);
    return keyboard;
};

// --- Bot Command Handlers ---
bot.command("start", (ctx) => ctx.reply("Kali System Bot is active."));
bot.command("whoami", (ctx) => ctx.reply(`Your Chat ID is: ${ctx.chat.id}`));

// --- Bot Callback Query Handlers (Interactive Buttons) ---
bot.on('callback_query:data', async (ctx) => {
    await ctx.answerCallbackQuery(); // Acknowledge the button press immediately
    const [action, orderId, ...rest] = ctx.callbackQuery.data.split(':');

    try {
        // Fetch the latest order state from DB
        const { data: orderFromDb, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (error || !orderFromDb) throw new Error(`Order ${orderId} not found.`);

        if (orderFromDb.items.length >= 64) {
            await ctx.reply("This order has too many items to be managed interactively. Please use the web app.");
            return;
        }

        if (action === 't') { // Toggle state without saving to DB
            const itemIndexToToggle = parseInt(rest[0], 10);
            const currentStateBitmask = BigInt(rest[1]);
            const newBitmask = currentStateBitmask ^ (1n << BigInt(itemIndexToToggle));

            // Create a temporary order object with the new state for message generation
            const tempOrder = { ...orderFromDb };
            tempOrder.items = orderFromDb.items.map((item: OrderItem, index: number) => ({
                ...item,
                isSpoiled: (newBitmask & (1n << BigInt(index))) !== 0n,
            }));
            
            // NO DB update, just edit the message to reflect the temporary state
            await ctx.editMessageText(generateManagerMessage(tempOrder), {
                parse_mode: 'HTML',
                reply_markup: generateManagerKeyboard(tempOrder, newBitmask),
            });

        } else if (action === 'c') { // Confirm and save final state to DB
            const finalStateBitmask = BigInt(rest[0]);

            const finalItems = orderFromDb.items.map((item: OrderItem, index: number) => ({
                ...item,
                isSpoiled: (finalStateBitmask & (1n << BigInt(index))) !== 0n,
            }));

            const receivedItems = finalItems.filter((item: OrderItem) => !item.isSpoiled);
            const spoiledItems = finalItems.filter((item: OrderItem) => item.isSpoiled);

            // Update original order to completed with only the received items
            const { error: updateError } = await supabase.from('orders').update({ 
                items: receivedItems,
                status: 'completed',
                is_received: true,
                completed_at: new Date().toISOString(),
                modified_at: new Date().toISOString()
            }).eq('id', orderId);
            if (updateError) throw updateError;

            // If there were spoiled items, create a new order for them
            if (spoiledItems.length > 0) {
                const now = new Date();
                const dateStr = `${now.getDate().toString().padStart(2, '0')}${ (now.getMonth() + 1).toString().padStart(2, '0')}`;
                const newOrderId = `${dateStr}_${orderFromDb.supplierName}_${orderFromDb.store}_REORDER`;

                const { error: insertError } = await supabase.from('orders').insert({
                    order_id: newOrderId,
                    store: orderFromDb.store,
                    supplier_id: orderFromDb.supplier_id,
                    items: spoiledItems.map(item => ({ ...item, isSpoiled: false })),
                    status: 'dispatching',
                    is_sent: false,
                    is_received: false,
                });
                if (insertError) throw insertError;
            }
            
            const finalOrderStateForMessage = { ...orderFromDb, items: finalItems };
            await ctx.editMessageText(`${generateManagerMessage(finalOrderStateForMessage)}\n\n<b>✅ Changes Confirmed & Processed.</b>`, { parse_mode: 'HTML' });
        }

    } catch (err) {
        console.error(err);
        await ctx.reply(`An error occurred: ${err.message}`);
    }
});


// --- Main Server Logic ---
serve(async (req) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (req.method === 'OPTIONS') return new Response('ok', { headers });

    try {
        const reqClone = req.clone();
        const body = await req.json().catch(() => ({}));

        if (body.endpoint) {
            // Handle API call from web app
            const { endpoint, ...payload } = body;
            
            if (endpoint === '/send-to-supplier') {
                const chatId = getChatId(payload.supplierName);
                if (!chatId) throw new Error(`Chat ID for supplier ${payload.supplierName} not found.`);
                await bot.api.sendMessage(chatId, payload.message, { parse_mode: 'HTML' });

            } else if (endpoint === '/send-to-store') {
                const chatId = getChatId(payload.order?.store);
                if (!chatId) throw new Error(`Chat ID for store ${payload.order?.store} not found.`);
                
                // Fetch full supplier info for message context
                const { data: supplier } = await supabase.from('suppliers').select('name').eq('id', payload.order.supplierId).single();
                const orderForBot: Order = { ...payload.order, supplierName: supplier?.name || 'Unknown' };

                // Determine initial spoiled state from the order data
                let initialBitmask = 0n;
                payload.order.items.forEach((item: OrderItem, index: number) => {
                    if (item.isSpoiled) {
                        initialBitmask |= (1n << BigInt(index));
                    }
                });

                await bot.api.sendMessage(chatId, generateManagerMessage(orderForBot), {
                    parse_mode: 'HTML',
                    reply_markup: generateManagerKeyboard(orderForBot, initialBitmask),
                });
                
            } else {
                throw new Error("Invalid API endpoint provided.");
            }
            
            return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", ...headers }});
        } else {
            // Assume it's a webhook from Telegram
            return await webhookCallback(bot, "std/http")(reqClone);
        }
    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json", ...headers }});
    }
});