// FIX: Use Deno's namespace type reference to resolve "Cannot find name 'Deno'" errors.
/// <reference lib="deno.ns" />

// supabase/functions/telegram-bot/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define types to match the client-side types.
// It's better to keep them here to avoid dependencies.
interface Order {
  id: string;
  orderId: string;
  store: string; // StoreName
  supplierId: string;
  supplierName: string; // SupplierName
  items: OrderItem[];
  status: string; // OrderStatus
  isSent: boolean;
  isReceived: boolean;
  createdAt: string;
  modifiedAt: string;
  completedAt?: string;
  invoiceUrl?: string;
}

interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  unit?: string; // Unit
  isSpoiled?: boolean;
}


const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'http://localhost:3000'; // Fallback for local dev

// Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!
);

async function sendMessage(chatId: string, text: string) {
  const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Telegram API error:', errorData);
    throw new Error(errorData.description || 'Failed to send message.');
  }
  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    } });
  }

  try {
    const { endpoint, ...payload } = await req.json();

    let chatId: string | undefined;

    if (endpoint === '/send-to-supplier') {
      const { supplierName, message } = payload;
      if (!supplierName || !message) throw new Error('Missing supplierName or message.');

      const { data: supplier, error } = await supabase
        .from('suppliers')
        .select('chat_id')
        .eq('name', supplierName)
        .single();
      
      if (error) throw error;
      if (!supplier?.chat_id) throw new Error(`Chat ID for supplier ${supplierName} not found.`);

      chatId = supplier.chat_id;
      await sendMessage(chatId, message);
      
    } else if (endpoint === '/send-to-store') {
      const order = payload.order as Order;
      if (!order) throw new Error('Missing order data.');
      
      const { data: store, error } = await supabase
        .from('stores')
        .select('chat_id')
        .eq('name', order.store)
        .single();

      if (error) throw error;
      if (!store?.chat_id) throw new Error(`Chat ID for store ${order.store} not found.`);

      chatId = store.chat_id;
      
      // Generate a manager-friendly message with a link
      const managerUrl = `${APP_BASE_URL}/#/?view=manager&store=${order.store}`;
      const message = `
📦 <b>New Delivery</b>
A new order for <b>${order.supplierName}</b> is on its way to <b>${order.store}</b>.

Order ID: <code>${order.orderId}</code>
Items: ${order.items.length}

Please mark items as received or spoiled upon arrival.

<a href="${managerUrl}">View Order Details</a>
      `.trim();
      
      await sendMessage(chatId, message);
      
    } else {
      throw new Error(`Invalid endpoint: ${endpoint}`);
    }

    return new Response(JSON.stringify({ success: true, chatId }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
      status: 200,
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
      status: 400,
    });
  }
})