// @deno-types="https://unpkg.com/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

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
    // Filter for matching item and supplier
    const prices = itemPrices.filter(p => p.itemId === itemId && p.supplierId === supplierId);
    if (prices.length === 0) return undefined;
    
    // 1. Try to find a Master Price
    const masterPrice = prices.find(p => p.isMaster);
    if (masterPrice) return masterPrice;
    
    // 2. If no Master Price, sort by createdAt descending to get the absolute latest
    // Ensure we are comparing valid dates
    return prices.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
    })[0];
};

const formatPrice = (price: number): string => price.toFixed(2);

const calculateOrderTotal = (order: Order, itemPrices: ItemPrice[]): number => {
    return order.items.reduce((total, item) => {
        if (item.isSpoiled) return total;
        
        // Priority: 1. Item's own price (if set/overridden) 2. Master/Latest price from DB 3. 0
        const latestPriceInfo = getLatestItemPrice(item.itemId, order.supplierId, itemPrices);
        const effectivePrice = item.price ?? latestPriceInfo?.price ?? 0;
        
        return total + (effectivePrice * item.quantity);
    }, 0);
};

const generateKaliUnifyReport = (orders: Order[], itemPrices: ItemPrice[], previousDue = 0, topUp = 0, dateKey: string): string => {
    const reportDate = new Date(dateKey + 'T00:00:00Z');
    const dateStr = reportDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    let report = `<b>${dateStr} KALI Due report</b>\n\n`;
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
        
        report += `<b>${storeName}</b>   ${formatPrice(storeTotal)}\n`;
        
        const itemMap = new Map<string, { name: string; quantity: number; totalValue: number; unit?: string }>();
        
        for (const order of storeOrders) {
            for (const item of order.items) {
                if (item.isSpoiled) continue;
                
                // Group items by ID + Unit (handling undefined units)
                const itemKey = `${item.itemId}-${item.unit || 'none'}`;
                
                const latestPriceInfo = getLatestItemPrice(item.itemId, order.supplierId, itemPrices);
                const effectivePrice = item.price ?? latestPriceInfo?.price ?? 0;
                
                const itemTotal = effectivePrice * item.quantity;
                
                const existing = itemMap.get(itemKey);
                if (existing) { 
                    existing.quantity += item.quantity; 
                    existing.totalValue += itemTotal; 
                } else { 
                    itemMap.set(itemKey, { name: item.name, quantity: item.quantity, totalValue: itemTotal, unit: item.unit }); 
                }
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
    let report = `<b>Date ${dateStr}</b>\nEST. report sum ${formatPrice(grandTotal)}\n---------------------\n\n`;
    
    for (const storeName of Object.keys(ordersByStore).sort()) {
        const storeOrders = ordersByStore[storeName];
        let storeTotal = Math.max(0, storeOrders.reduce((sum, order) => sum + calculateOrderTotal(order, itemPrices), 0));
        report += `<b>${storeName}</b> ${formatPrice(storeTotal)}\n`;
        
        const itemMap = new Map<string, { name: string; quantity: number; totalValue: number; unit?: string }>();
        for (const order of storeOrders) {
            for (const item of order.items) {
                if (item.isSpoiled) continue;
                const itemKey = `${item.itemId}-${item.unit || 'none'}`;
                
                const latestPriceInfo = getLatestItemPrice(item.itemId, order.supplierId, itemPrices);
                const price = item.price ?? latestPriceInfo?.price ?? 0;
                
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
    try {
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
        } else if (text === '/salmon') {
            await handleSalmonOrder(chat.id);
        }
    } catch (e) {
        console.error(`Error handling command "${text}":`, e);
        await sendMessageToChat(chat.id, `⚠️ Error processing your command: ${e.message}`);
    }
}

async function handleCallbackQuery(query: any) {
  const { data, id, message } = query;
  if (!data || typeof data !== 'string') return;
  const parts = data.split('_');
  const recordId = parts.pop();
  const action = parts.join('_');
  if (action === 'approve_order' && recordId) await handleApproveOrder(id, recordId);
  else if (action === 'trigger_qo' && recordId) await handleTriggerQuickOrder(id, recordId, message.chat.id);
}

// --- Helpers ---
async function getKaliSupplierId(supabase: any): Promise<string | null> {
    const { data } = await supabase.from('suppliers').select('id').eq('name', 'KALI').maybeSingle();
    return data?.id || null;
}

// --- Report Handlers ---
async function handleEstReport(chatId: number) {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    
    const kaliId = await getKaliSupplierId(supabase);
    let query = supabase.from('orders').select('*, suppliers(name)').eq('status', 'on_the_way');
    
    if (kaliId) {
        query = query.or(`payment_method.eq.kali,supplier_id.eq.${kaliId}`);
    } else {
        query = query.eq('payment_method', 'kali');
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) throw new Error(`DB Error (Orders): ${ordersError.message}`);
    if (orders.length === 0) { await sendMessageToChat(chatId, 'No KALI orders are currently on the way.'); return; }
    // Fetch prices with explicit casting/handling to ensure we get them all
    const { data: itemPrices, error: pricesError } = await supabase.from('item_prices').select('*');
    if (pricesError) throw new Error(`DB Error (Prices): ${pricesError.message}`);
    
    const mappedOrders: Order[] = orders.map((o: any) => ({ ...o, supplierName: o.suppliers.name, orderId: o.order_id }));

    // Pass explicitly typed/fetched itemPrices to generation logic
    const report = generateKaliZapReport(mappedOrders, itemPrices as ItemPrice[]);
    await sendMessageToChat(chatId, report, 'HTML');
}

async function handleDueReport(chatId: number) {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const todayKey = getPhnomPenhDateKey();
    const kaliId = await getKaliSupplierId(supabase);
    
    let query = supabase.from('orders').select('*, suppliers(name)').eq('status', 'completed');
    
    if (kaliId) {
        query = query.or(`payment_method.eq.kali,supplier_id.eq.${kaliId}`);
    } else {
        query = query.eq('payment_method', 'kali');
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) throw new Error(`DB Error (Orders): ${ordersError.message}`);
    
    // Fetch ALL item prices to ensure we have history
    const { data: itemPrices, error: pricesError } = await supabase.from('item_prices').select('*');
    if (pricesError) throw new Error(`DB Error (Prices): ${pricesError.message}`);
    
    const { data: topUps, error: topUpsError } = await supabase.from('due_report_top_ups').select('*');
    if (topUpsError) throw new Error(`DB Error (TopUps): ${topUpsError.message}`);

    const todaysOrders = orders.filter((o: any) => getPhnomPenhDateKey(o.completed_at) === todayKey).map((o: any) => ({ ...o, supplierName: o.suppliers.name, orderId: o.order_id }));
    const todaysTopUp = topUps.find((t: any) => t.date === todayKey)?.amount || 0;
    
    const hardcodedInitialBalance = 146.26;
    let previousDue = hardcodedInitialBalance;
    const allDates = [...new Set([...orders.map((o: any) => getPhnomPenhDateKey(o.completed_at)), ...topUps.map((t: any) => t.date)])].sort();
    
    // Use the fetched itemPrices for historical calculation as well
    const pricesArray = itemPrices as ItemPrice[];

    for (const dateKey of allDates) {
        if (dateKey >= todayKey) break;
        const spend = orders.filter((o: any) => getPhnomPenhDateKey(o.completed_at) === dateKey).reduce((sum, o) => sum + calculateOrderTotal({ ...o, supplierName: o.suppliers.name, orderId: o.order_id }, pricesArray), 0);
        const topUp = topUps.find((t: any) => t.date === dateKey)?.amount || 0;
        previousDue = previousDue + topUp - spend;
    }

    const report = generateKaliUnifyReport(todaysOrders, pricesArray, previousDue, todaysTopUp, todayKey);
    await sendMessageToChat(chatId, report, 'HTML');
}

async function handleSalmonOrder(chatId: number) {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    
    const { data: qo, error: qoError } = await supabase.from('quick_orders')
        .select('*, suppliers(*)')
        .ilike('name', '%salmon%')
        .limit(1)
        .maybeSingle();
        
    if (qoError || !qo) {
        await sendMessageToChat(chatId, "Salmon quick order not found.");
        return;
    }

    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, '0')}${ (now.getMonth() + 1).toString().padStart(2, '0')}`;
    const newOrderId = `${dateStr}_${qo.suppliers.name}_${qo.store}_BOT`;
    
    const { data: order, error: orderError } = await supabase.from('orders').insert({
        order_id: newOrderId,
        store: qo.store,
        supplier_id: qo.supplier_id,
        status: 'on_the_way',
        is_sent: true,
        created_at: now.toISOString(),
        modified_at: now.toISOString(),
        items: qo.items
    }).select().single();

    if (orderError) {
        await sendMessageToChat(chatId, `Failed to create order: ${orderError.message}`);
        return;
    }

    if (TELEGRAM_BOT_TOKEN && qo.suppliers.chat_id) {
        const itemsList = (qo.items as any[]).map(i => `${i.name} x${i.quantity}${i.unit ? ' ' + i.unit : ''}`).join('\n');
        const msg = `<b>Order ${newOrderId} for ${qo.store}</b>\n${itemsList}`;
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: qo.suppliers.chat_id, text: msg, parse_mode: 'HTML' })
        });
    }

    await sendMessageToChat(chatId, `Salmon order created and sent to ${qo.suppliers.name}!`);
}


async function handleQuickOrderList(chatId: number) {
    if (!TELEGRAM_BOT_TOKEN) return;
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data, error } = await supabase.from('quick_orders').select('*');
    if (error) throw new Error(`DB Error (QuickOrders): ${error.message}`);
    if (!data || data.length === 0) { await sendMessageToChat(chatId, "No quick orders found."); return; }
    const buttons = data.map((qo: any) => ([{ text: `${qo.name} (${qo.store})`, callback_data: `trigger_qo_${qo.id}` }]));
    await sendMessageToChat(chatId, "<b>Select a Quick Order:</b>", 'HTML', { inline_keyboard: buttons });
}

async function handleTriggerQuickOrder(queryId: string, quickOrderId: string, chatId: number) {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    
    const { data: qo, error: qoError } = await supabase.from('quick_orders')
        .select('*, suppliers(*)')
        .eq('id', quickOrderId)
        .single();
        
    if (qoError || !qo) {
        await answerCallbackQuery(queryId, "Error: Quick order not found.", true);
        return;
    }

    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, '0')}${ (now.getMonth() + 1).toString().padStart(2, '0')}`;
    const newOrderId = `${dateStr}_${qo.suppliers.name}_${qo.store}_BOT`;
    
    // Create the order in 'dispatch' status first, then move to 'on_the_way' to simulate flow
    // But for a quick trigger, let's just go straight to 'on_the_way' and 'is_sent'
    const { data: order, error: orderError } = await supabase.from('orders').insert({
        order_id: newOrderId,
        store: qo.store,
        supplier_id: qo.supplier_id,
        status: 'on_the_way',
        is_sent: true,
        created_at: now.toISOString(),
        modified_at: now.toISOString(),
        items: qo.items
    }).select().single();

    if (orderError) {
        await answerCallbackQuery(queryId, `Error creating order: ${orderError.message}`, true);
        return;
    }

    // Notify Supplier
    if (TELEGRAM_BOT_TOKEN && qo.suppliers.chat_id) {
        const itemsList = (qo.items as any[]).map(i => `${i.name} x${i.quantity}${i.unit ? ' ' + i.unit : ''}`).join('\n');
        const msg = `<b>Order ${newOrderId} for ${qo.store}</b>\n${itemsList}`;
        
        // We use fetch directly here to avoid importing the frontend helper which might have node deps
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: qo.suppliers.chat_id, text: msg, parse_mode: 'HTML' })
        });
    }

    await answerCallbackQuery(queryId, `Quick Order "${qo.name}" executed!`);
    await sendMessageToChat(chatId, `✅ Quick Order <b>${qo.name}</b> created for ${qo.store}!`, 'HTML');
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