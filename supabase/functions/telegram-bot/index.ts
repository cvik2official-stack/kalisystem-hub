// @deno-types="https://unpkg.com/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');

// --- Types (subset of frontend types) ---
interface Order { id: string; orderId: string; store: string; supplierId: string; supplierName: string; items: OrderItem[]; completedAt?: string; paymentMethod?: string; status: string; }
interface OrderItem { itemId: string; name: string; quantity: number; unit?: string; price?: number; isSpoiled?: boolean; }
interface ItemPrice { itemId: string; supplierId: string; price: number; unit: string; isMaster?: boolean; createdAt: string; }
interface DueReportTopUp { date: string; amount: number; }

// --- Date Helpers (ported from frontend) ---
const PHNOM_PENH_OFFSET = 7 * 60;
const BUSINESS_DAY_START_HOUR = 6;
const getPhnomPenhDate = (date?: Date | string): Date => {
    const d = date ? new Date(date) : new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (PHNOM_PENH_OFFSET * 60000));
};
const getPhnomPenhDateKey = (date?: Date | string): string => {
    const ppDate = getPhnomPenhDate(date);
    ppDate.setHours(ppDate.getHours() - BUSINESS_DAY_START_HOUR);
    return ppDate.toISOString().split('T')[0];
};

// --- Report Generation Logic (ported from frontend) ---
const getLatestItemPrice = (itemId: string, supplierId: string, itemPrices: ItemPrice[]): ItemPrice | undefined => {
    const prices = itemPrices.filter(p => p.itemId === itemId && p.supplierId === supplierId);
    if (prices.length === 0) return undefined;
    const masterPrice = prices.find(p => p.isMaster);
    if (masterPrice) return masterPrice;
    return prices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
};
const formatPrice = (price: number): string => price.toFixed(2);
const calculateOrderTotal = (order: Order, itemPrices: ItemPrice[]): number => {
    return order.items.reduce((total, item) => {
        if (item.isSpoiled) return total;
        const latestPrice = getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price ?? 0;
        return total + ((item.price ?? latestPrice) * item.quantity);
    }, 0);
};
const generateKaliUnifyReport = (orders: Order[], itemPrices: ItemPrice[], previousDue = 0, topUp = 0, dateKey: string): string => {
    const reportDate = new Date(dateKey + 'T00:00:00Z');
    const dateStr = reportDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    let report = `${dateStr} KALI Due report\n\n`;
    const ordersByStore = orders.reduce((acc, order) => {
        if (!acc[order.store]) acc[order.store] = [];
        acc[order.store].push(order);
        return acc;
    }, {} as Record<string, Order[]>);
    let grandTotal = 0;
    for (const storeName of Object.keys(ordersByStore).sort()) {
        const storeOrders = ordersByStore[storeName];
        const storeTotal = storeOrders.reduce((sum, order) => sum + calculateOrderTotal(order, itemPrices), 0);
        grandTotal += storeTotal;
        report += `${storeName.padEnd(8, ' ')} ${formatPrice(storeTotal)}\n`;
        const itemMap = new Map<string, { name: string; quantity: number; totalValue: number; unit?: string }>();
        for (const order of storeOrders) {
            for (const item of order.items) {
                if (item.isSpoiled) continue;
                const itemKey = `${item.itemId}-${item.unit || 'none'}`;
                const price = item.price ?? getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price ?? 0;
                const itemTotal = price * item.quantity;
                const existing = itemMap.get(itemKey);
                if (existing) { existing.quantity += item.quantity; existing.totalValue += itemTotal; }
                else { itemMap.set(itemKey, { name: item.name, quantity: item.quantity, totalValue: itemTotal, unit: item.unit }); }
            }
        }
        for (const item of Array.from(itemMap.values()).sort((a, b) => a.name.localeCompare(b.name))) {
            const unitPrice = item.quantity > 0 ? item.totalValue / item.quantity : 0;
            report += `  ${formatPrice(item.totalValue)} ${item.name} ${formatPrice(unitPrice)} x${item.quantity}${item.unit || ''}\n`;
        }
        report += '\n';
    }
    const totalDue = previousDue + grandTotal - topUp;
    report += `---------------------\nPREV DUE  : ${formatPrice(previousDue)}\nSPENDINGS : ${formatPrice(grandTotal)}\nTOP UP    : ${formatPrice(topUp)}\nTOTAL DUE : ${formatPrice(totalDue)}`;
    return report;
};
const generateKaliZapReport = (orders: Order[], itemPrices: ItemPrice[]): string => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
    const ordersByStore = orders.reduce((acc, order) => {
        if (!acc[order.store]) acc[order.store] = [];
        acc[order.store].push(order);
        return acc;
    }, {} as Record<string, Order[]>);
    let grandTotal = Math.max(0, orders.reduce((sum, order) => sum + calculateOrderTotal(order, itemPrices), 0));
    let report = `Date ${dateStr}\nEST. report sum ${formatPrice(grandTotal)}\n---------------------\n\n`;
    for (const storeName of Object.keys(ordersByStore).sort()) {
        const storeOrders = ordersByStore[storeName];
        let storeTotal = Math.max(0, storeOrders.reduce((sum, order) => sum + calculateOrderTotal(order, itemPrices), 0));
        report += `${storeName} ${formatPrice(storeTotal)}\n`;
        const itemMap = new Map<string, { name: string; quantity: number; totalValue: number; unit?: string }>();
        for (const order of storeOrders) {
            for (const item of order.items) {
                if (item.isSpoiled) continue;
                const itemKey = `${item.itemId}-${item.unit || 'none'}`;
                const price = item.price ?? getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price ?? 0;
                const itemTotal = price * item.quantity;
                const existing = itemMap.get(itemKey);
                if (existing) { existing.quantity += item.quantity; existing.totalValue += itemTotal; }
                else { itemMap.set(itemKey, { name: item.name, quantity: item.quantity, totalValue: itemTotal, unit: item.unit }); }
            }
        }
        for (const item of Array.from(itemMap.values()).sort((a, b) => a.name.localeCompare(b.name))) {
            const unitPrice = item.quantity > 0 ? item.totalValue / item.quantity : 0;
            report += ` ${formatPrice(item.totalValue)} ${item.name}  (${formatPrice(unitPrice)}) x${item.quantity}${item.unit || ''}\n`;
        }
        report += `\n`;
    }
    return report;
};


// --- Telegram Bot Logic ---
serve(async (req)=>{
    if (!TELEGRAM_WEBHOOK_SECRET || new URL(req.url).searchParams.get('secret') !== TELEGRAM_WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
    }
  const ack = new Promise(r => setTimeout(() => r(new Response(null, { status: 200 })), 0));
  processRequest(req).catch(e => console.error("Error processing request:", e));
  return await ack;
});

async function processRequest(req: Request) {
  if (req.method !== 'POST') return;
  try {
    const payload = await req.json();
    if (payload.callback_query) await handleCallbackQuery(payload.callback_query);
    else if (payload.message) await handleMessage(payload.message);
  } catch (e) {
    console.error('Failed to parse or process webhook payload:', e);
  }
}

async function handleMessage(message: any) {
    if (!message.text) return;
    const { chat, text } = message;
    if (text === '/whoami') {
        const { from } = message;
        const responseText = `*Chat ID:* \`${chat.id}\`\n*User ID:* \`${from.id}\`\n*Name:* ${from.first_name || ''} ${from.last_name || ''}`.trim();
        await sendMessageToChat(chat.id, responseText, 'Markdown');
    } else if (text === '/quickorder') {
        await handleQuickOrderList(chat.id);
    } else if (text === '/est') {
        await handleEstReport(chat.id);
    } else if (text === '/due') {
        await handleDueReport(chat.id);
    }
}

async function handleCallbackQuery(query: any) {
  const { data, id, message } = query;
  if (!data || typeof data !== 'string') return;
  const parts = data.split('_');
  const recordId = parts.pop();
  const action = parts.join('_');
  if (action === 'approve_order' && recordId) await handleApproveOrder(id, recordId);
  else if (action === 'trigger_qo' && recordId) await answerCallbackQuery(id, "This must be triggered from the app.", true);
}

// --- Report Handlers ---
async function handleEstReport(chatId: number) {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: orders, error: ordersError } = await supabase.from('orders').select('*, suppliers(name)').eq('status', 'on_the_way').or('payment_method.eq.kali,suppliers.name.eq.KALI');
    if (ordersError) { await sendMessageToChat(chatId, `Error fetching orders: ${ordersError.message}`); return; }
    if (orders.length === 0) { await sendMessageToChat(chatId, 'No KALI orders are currently on the way.'); return; }
    const { data: itemPrices, error: pricesError } = await supabase.from('item_prices').select('*');
    if (pricesError) { await sendMessageToChat(chatId, `Error fetching prices: ${pricesError.message}`); return; }
    
    // Transform orders to match frontend structure
    const mappedOrders: Order[] = orders.map((o: any) => ({ ...o, supplierName: o.suppliers.name, orderId: o.order_id }));

    const report = generateKaliZapReport(mappedOrders, itemPrices);
    await sendMessageToChat("5186573916", report); // Send to KALI_ZAP_CHAT_ID
}

async function handleDueReport(chatId: number) {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const todayKey = getPhnomPenhDateKey();
    const yesterdayKey = getPhnomPenhDateKey(new Date(Date.now() - 86400000));
    
    // Fetch orders, prices, and top-ups
    const { data: orders, error: ordersError } = await supabase.from('orders').select('*, suppliers(name)').eq('status', 'completed').or('payment_method.eq.kali,suppliers.name.eq.KALI');
    if (ordersError) { await sendMessageToChat(chatId, `Error fetching orders: ${ordersError.message}`); return; }
    const { data: itemPrices, error: pricesError } = await supabase.from('item_prices').select('*');
    if (pricesError) { await sendMessageToChat(chatId, `Error fetching prices: ${pricesError.message}`); return; }
    const { data: topUps, error: topUpsError } = await supabase.from('due_report_top_ups').select('*');
    if (topUpsError) { await sendMessageToChat(chatId, `Error fetching top-ups: ${topUpsError.message}`); return; }

    // Filter and process data
    const todaysOrders = orders.filter((o: any) => getPhnomPenhDateKey(o.completed_at) === todayKey).map((o: any) => ({ ...o, supplierName: o.suppliers.name, orderId: o.order_id }));
    const todaysTopUp = topUps.find((t: any) => t.date === todayKey)?.amount || 0;
    
    // Calculate previous day's due amount
    const hardcodedInitialBalance = 146.26;
    let previousDue = hardcodedInitialBalance;
    const allDates = [...new Set([...orders.map((o: any) => getPhnomPenhDateKey(o.completed_at)), ...topUps.map((t: any) => t.date)])].sort();
    
    for (const dateKey of allDates) {
        if (dateKey >= todayKey) break;
        const spend = orders.filter((o: any) => getPhnomPenhDateKey(o.completed_at) === dateKey).reduce((sum, o) => sum + calculateOrderTotal({ ...o, supplierName: o.suppliers.name, orderId: o.order_id }, itemPrices), 0);
        const topUp = topUps.find((t: any) => t.date === dateKey)?.amount || 0;
        previousDue = previousDue + topUp - spend;
    }

    const report = generateKaliUnifyReport(todaysOrders, itemPrices, previousDue, todaysTopUp, todayKey);
    await sendMessageToChat("-1003065576801", report); // Send to KALI_UNIFY_CHAT_ID
}


async function handleQuickOrderList(chatId: number) {
    if (!TELEGRAM_BOT_TOKEN) return;
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data, error } = await supabase.from('quick_orders').select('*');
    if (error || !data || data.length === 0) { await sendMessageToChat(chatId, "No quick orders found."); return; }
    const buttons = data.map((qo: any) => ([{ text: `${qo.name} (${qo.store})`, callback_data: `trigger_qo_${qo.id}` }]));
    await sendMessageToChat(chatId, "<b>Select a Quick Order:</b>", 'HTML', { inline_keyboard: buttons });
}

async function handleApproveOrder(queryId: string, orderId: string) {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data, error } = await supabase.from('orders').update({ is_acknowledged: true }).eq('id', orderId).select().single();
    if (error) { await answerCallbackQuery(queryId, "Error: Could not find order.", true); return; }
    if (data) await answerCallbackQuery(queryId, `Order ${data.order_id} Acknowledged!`);
  } catch (e) {
    await answerCallbackQuery(queryId, "An internal error occurred.", true);
  }
}

// --- Telegram API Helpers ---
async function answerCallbackQuery(id: string, text: string, showAlert = false) {
  if (!TELEGRAM_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text, show_alert: showAlert })
  });
}
async function sendMessageToChat(chatId: number | string, text: string, parseMode?: string, replyMarkup?: object) {
    if (!TELEGRAM_BOT_TOKEN) return;
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode, reply_markup: replyMarkup }),
    });
}
