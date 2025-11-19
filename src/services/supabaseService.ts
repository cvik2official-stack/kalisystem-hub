/*
  NOTE FOR DATABASE SETUP:
  This service now supports an 'invoice_amount' for orders and 'bot_settings' for suppliers.
  Please run the following SQL commands in your Supabase SQL Editor:

  -- Add a numeric column to store the invoice amount
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC;

  -- Add a JSONB column to store bot settings for suppliers
  -- This column stores an object for settings like 'showAttachInvoice', 'showMissingItems', 'enableReminderTimer', and 'messageTemplate'.
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bot_settings JSONB;

  -- Create a table to store item prices per supplier
  CREATE TABLE IF NOT EXISTS public.item_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    price NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    is_master BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(item_id, supplier_id, unit)
  );

  -- Add a text column to store an order-specific payment method override
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;

  -- Add a boolean column to track OUDOM acknowledgment
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_acknowledged BOOLEAN DEFAULT FALSE;

  -- Add a timestamp column to track when an automated reminder was sent
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

  -- Add a text column to stores for a location URL
  ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS location_url TEXT;

  -- Add a text column for supplier contact info
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact TEXT;

  -- Add a numeric column for stock quantity on items
  ALTER TABLE public.items ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC;
  
  -- Create the table for Due Report top-up amounts
  CREATE TABLE IF NOT EXISTS public.due_report_top_ups (
    date DATE PRIMARY KEY,
    amount NUMERIC NOT NULL
  );

  -- Seed the top-up table with historical data (run this only once)
  INSERT INTO public.due_report_top_ups (date, amount) VALUES
      ('2025-11-01', 140.00), ('2025-11-02', 100.00), ('2025-11-03', 354.25),
      ('2025-11-04', 125.00), ('2025-11-05', 300.00), ('2025-11-06', 250.00),
      ('2025-11-07', 100.00), ('2025-11-08', 315.00), ('2025-11-09', 150.00),
      ('2025-11-10', 250.00), ('2025-11-11', 312.00), ('2025-11-12', 200.00),
      ('2025-11-13', 110.00), ('2025-11-14', 100.00)
  ON CONFLICT (date) DO NOTHING;

  -- Add table for Quick Orders
  CREATE TABLE IF NOT EXISTS public.quick_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    store TEXT NOT NULL,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
  );

*/
import { Item, Order, OrderItem, Supplier, SupplierName, StoreName, OrderStatus, Unit, PaymentMethod, Store, SupplierBotSettings, ItemPrice, DueReportTopUp, QuickOrder } from '../types';

interface SupabaseCredentials {
  url: string;
  key: string;
}

// Interfaces for raw database responses with snake_case properties
interface SupplierFromDb {
  id: string;
  name: SupplierName;
  modified_at: string;
  chat_id?: string;
  payment_method?: PaymentMethod;
  bot_settings?: SupplierBotSettings;
  contact?: string;
}

interface ItemFromDb {
  id: string;
  name: string;
  unit: Unit;
  supplier_id: string;
  created_at: string;
  modified_at: string;
  stock_quantity?: number;
}

interface StoreFromDb {
  id: string;
  name: StoreName;
  chat_id?: string;
  location_url?: string;
}

interface OrderFromDb {
    id: string;
    order_id: string;
    store: StoreName;
    supplier_id: string;
    status: OrderStatus;
    is_sent: boolean;
    is_received: boolean;
    created_at: string;
    modified_at: string;
    completed_at?: string;
    items: OrderItem[];
    invoice_url?: string;
    invoice_amount?: number;
    payment_method?: PaymentMethod;
    is_acknowledged?: boolean;
    reminder_sent_at?: string;
}

interface ItemPriceFromDb {
    id: string;
    item_id: string;
    supplier_id: string;
    price: number;
    unit: Unit;
    created_at: string;
    // FIX: Add is_master property to align with database schema.
    is_master?: boolean;
}

interface DueReportTopUpFromDb {
  date: string;
  amount: number;
}

interface QuickOrderFromDb {
    id: string;
    name: string;
    store: StoreName;
    supplier_id: string;
    items: OrderItem[];
}


const getHeaders = (key: string) => ({
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
});


// --- READ OPERATIONS ---

export const getItemsAndSuppliersFromSupabase = async ({ url, key }: SupabaseCredentials): Promise<{ items: Item[], suppliers: Supplier[], stores: Store[], itemPrices: ItemPrice[], dueReportTopUps: DueReportTopUp[], quickOrders: QuickOrder[] }> => {
  const headers = getHeaders(key);

  try {
    const [suppliersResponse, itemsResponse, storesResponse, itemPricesResponse, dueReportTopUpsResponse, quickOrdersResponse] = await Promise.all([
        fetch(`${url}/rest/v1/suppliers?select=*`, { headers }),
        fetch(`${url}/rest/v1/items?select=*`, { headers }),
        fetch(`${url}/rest/v1/stores?select=*`, { headers }),
        fetch(`${url}/rest/v1/item_prices?select=*`, { headers }),
        fetch(`${url}/rest/v1/due_report_top_ups?select=*`, { headers }),
        fetch(`${url}/rest/v1/quick_orders?select=*`, { headers }),
    ]);

    if (!suppliersResponse.ok) throw new Error(`Failed to fetch suppliers: ${await suppliersResponse.text()}`);
    if (!itemsResponse.ok) throw new Error(`Failed to fetch items: ${await itemsResponse.text()}`);
    if (!storesResponse.ok) throw new Error(`Failed to fetch stores: ${await storesResponse.text()}`);
    if (!itemPricesResponse.ok) throw new Error(`Failed to fetch item prices: ${await itemPricesResponse.text()}`);
    if (!dueReportTopUpsResponse.ok) throw new Error(`Failed to fetch due report top ups: ${await dueReportTopUpsResponse.text()}`);
    
    let quickOrdersData: QuickOrderFromDb[] = [];
    if (quickOrdersResponse.ok) {
        quickOrdersData = await quickOrdersResponse.json();
    } else {
        console.warn("Quick orders table might not exist yet.");
    }

    const suppliersData: SupplierFromDb[] = await suppliersResponse.json();
    const itemsData: ItemFromDb[] = await itemsResponse.json();
    const storesData: StoreFromDb[] = await storesResponse.json();
    const itemPricesData: ItemPriceFromDb[] = await itemPricesResponse.json();
    const dueReportTopUpsData: DueReportTopUpFromDb[] = await dueReportTopUpsResponse.json();
    
    const stores: Store[] = storesData.map(s => ({
      id: s.id,
      name: s.name,
      chatId: s.chat_id,
      locationUrl: s.location_url,
    }));
    
    const supplierMap = new Map<string, Supplier>(suppliersData.map((s) => [s.id, {
        id: s.id,
        name: s.name,
        chatId: s.chat_id,
        paymentMethod: s.payment_method,
        modifiedAt: s.modified_at,
        botSettings: s.bot_settings,
        contact: s.contact,
    }]));
    
    const items: Item[] = itemsData.reduce((acc: Item[], i) => {
        const supplier = supplierMap.get(i.supplier_id);
        if (supplier) {
            acc.push({
                id: i.id,
                name: i.name,
                unit: i.unit,
                supplierId: i.supplier_id,
                supplierName: supplier.name,
                createdAt: i.created_at,
                modifiedAt: i.modified_at,
                stockQuantity: i.stock_quantity,
            });
        }
        return acc;
    }, []);

    const itemPrices: ItemPrice[] = itemPricesData.map(p => ({
        id: p.id,
        itemId: p.item_id,
        supplierId: p.supplier_id,
        price: p.price,
        unit: p.unit,
        createdAt: p.created_at,
        // FIX: Map is_master from database to isMaster in the application state.
        isMaster: p.is_master,
    }));

    const dueReportTopUps: DueReportTopUp[] = dueReportTopUpsData.map(t => ({
        date: t.date,
        amount: t.amount,
    }));
    
    // FIX: Refactored to be type-safe. Map to an object with supplier or null, then filter out nulls.
    const quickOrders: QuickOrder[] = quickOrdersData.map(q => {
        const supplier = supplierMap.get(q.supplier_id);
        if (!supplier) {
            return null;
        }
        return {
            id: q.id,
            name: q.name,
            store: q.store,
            supplierId: q.supplier_id,
            supplierName: supplier.name,
            items: q.items || [],
        };
    }).filter((q): q is QuickOrder => q !== null);

    return { items, suppliers: Array.from(supplierMap.values()), stores, itemPrices, dueReportTopUps, quickOrders };

  } catch (error) {
    console.error("Error fetching from Supabase:", error);
    throw error;
  }
};

export const getOrdersFromSupabase = async ({ url, key, suppliers }: { url: string; key: string; suppliers: Supplier[] }): Promise<Order[]> => {
    const headers = getHeaders(key);
    const supplierMap = new Map<string, Supplier>(suppliers.map(s => [s.id, s]));

    // Fetch all order data, assuming 'items' is a JSONB column.
    const ordersResponse = await fetch(`${url}/rest/v1/orders?select=*`, { headers });
    if (!ordersResponse.ok) throw new Error(`Failed to fetch orders: ${await ordersResponse.text()}`);
    
    const ordersData: OrderFromDb[] = await ordersResponse.json();
    
    // Map the database response to the application's Order type.
    return ordersData
        .filter(Boolean)
        .reduce((acc: Order[], order) => {
            const supplier = supplierMap.get(order.supplier_id);
            if (supplier) {
                acc.push({
                    id: order.id,
                    orderId: order.order_id,
                    store: order.store,
                    supplierId: order.supplier_id,
                    supplierName: supplier.name,
                    status: order.status,
                    isSent: order.is_sent,
                    isReceived: order.is_received,
                    createdAt: order.created_at,
                    modifiedAt: order.modified_at,
                    completedAt: order.completed_at,
                    invoiceUrl: order.invoice_url,
                    invoiceAmount: order.invoice_amount,
                    paymentMethod: order.payment_method,
                    isAcknowledged: order.is_acknowledged,
                    reminderSentAt: order.reminder_sent_at,
                    // Assume 'items' column exists and is an array of OrderItem or null.
                    items: order.items || [], 
                });
            } else {
                console.warn(`Order with id ${order.id} has an unknown supplier_id ${order.supplier_id}. Skipping.`);
            }
            return acc;
        }, []);
};

export const getAcknowledgedOrderUpdates = async ({ orderIds, url, key }: { orderIds: string[]; url: string; key: string }): Promise<{id: string, order_id: string}[]> => {
    const headers = getHeaders(key);
    const response = await fetch(`${url}/rest/v1/orders?select=id,order_id&id=in.(${orderIds.join(',')})&is_acknowledged=eq.true`, { headers });
    if (!response.ok) {
        // It's okay for this lightweight poll to fail, don't throw a fatal error.
        console.warn(`Failed to fetch order updates: ${await response.text()}`);
        return [];
    }
    return await response.json();
};


// --- WRITE OPERATIONS ---

export const addOrder = async ({ order, url, key }: { order: Order; url: string; key: string }): Promise<Order> => {
    const headers = getHeaders(key);
    const { id, ...orderData } = order;

    // The payload now includes the 'items' array.
    const orderPayload = {
        order_id: orderData.orderId,
        store: orderData.store,
        supplier_id: orderData.supplierId,
        status: orderData.status,
        is_sent: orderData.isSent,
        is_received: orderData.isReceived,
        created_at: orderData.createdAt,
        modified_at: orderData.modifiedAt,
        completed_at: orderData.completedAt,
        items: orderData.items,
        invoice_url: orderData.invoiceUrl,
        invoice_amount: orderData.invoiceAmount,
        payment_method: orderData.paymentMethod,
        is_acknowledged: orderData.isAcknowledged,
        reminder_sent_at: orderData.reminderSentAt,
    };

    const orderResponse = await fetch(`${url}/rest/v1/orders?select=*`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(orderPayload)
    });
    if (!orderResponse.ok) throw new Error(`Failed to add order: ${await orderResponse.text()}`);
    
    const newOrderFromDb = (await orderResponse.json())[0];
    
    return { 
        ...order, 
        id: newOrderFromDb.id, 
        modifiedAt: newOrderFromDb.modified_at 
    };
};


export const updateOrder = async ({ order, url, key }: { order: Order; url: string; key: string }): Promise<Order> => {
    const headers = getHeaders(key);
    const now = new Date().toISOString();

    // The payload now includes the 'items' array.
    const orderPayload = {
        store: order.store,
        supplier_id: order.supplierId, // Allow supplier changes
        status: order.status,
        is_sent: order.isSent,
        is_received: order.isReceived,
        modified_at: now,
        completed_at: order.completedAt,
        items: order.items,
        invoice_url: order.invoiceUrl,
        invoice_amount: order.invoiceAmount,
        payment_method: order.paymentMethod,
        is_acknowledged: order.isAcknowledged,
        reminder_sent_at: order.reminderSentAt,
    };
    const orderResponse = await fetch(`${url}/rest/v1/orders?id=eq.${order.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(orderPayload)
    });
    if (!orderResponse.ok) throw new Error(`Failed to update order: ${await orderResponse.text()}`);

    return { ...order, modifiedAt: now };
};


export const deleteOrder = async ({ orderId, url, key }: { orderId: string; url: string; key: string }): Promise<void> => {
    const headers = getHeaders(key);
    const response = await fetch(`${url}/rest/v1/orders?id=eq.${orderId}`, {
        method: 'DELETE',
        headers
    });
    if (!response.ok) throw new Error(`Failed to delete order: ${await response.text()}`);
};


export const addItem = async ({ item, url, key }: { item: Omit<Item, 'id'>, url: string, key: string }): Promise<Item> => {
    const payload = {
        name: item.name,
        unit: item.unit,
        supplier_id: item.supplierId,
        stock_quantity: item.stockQuantity,
    };
    const response = await fetch(`${url}/rest/v1/items?select=*`, {
        method: 'POST',
        headers: { ...getHeaders(key), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Failed to add item: ${await response.text()}`);
    const data = await response.json();
    const newItem = data[0];
    return {
        ...item,
        id: newItem.id,
        createdAt: newItem.created_at,
        modifiedAt: newItem.modified_at,
        stockQuantity: newItem.stock_quantity,
    };
};

export const updateItem = async ({ item, url, key }: { item: Item, url: string, key: string }): Promise<Item> => {
    const payload = {
        name: item.name,
        unit: item.unit,
        supplier_id: item.supplierId,
        stock_quantity: item.stockQuantity,
    };
    const response = await fetch(`${url}/rest/v1/items?id=eq.${item.id}&select=*`, {
        method: 'PATCH',
        headers: { ...getHeaders(key), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Failed to update item: ${await response.text()}`);
    const data = await response.json();
    const updatedItem = data[0];
    return { ...item, modifiedAt: updatedItem.modified_at };
};

export const deleteItem = async ({ itemId, url, key }: { itemId: string, url: string, key: string }): Promise<void> => {
    const response = await fetch(`${url}/rest/v1/items?id=eq.${itemId}`, {
        method: 'DELETE',
        headers: getHeaders(key)
    });
    if (!response.ok) throw new Error(`Failed to delete item: ${await response.text()}`);
};

export const addSupplier = async ({ supplier, url, key }: { supplier: Partial<Supplier> & { name: SupplierName }, url: string, key: string }): Promise<Supplier> => {
    const payload = {
        name: supplier.name,
        chat_id: supplier.chatId,
        payment_method: supplier.paymentMethod,
        bot_settings: supplier.botSettings,
        contact: supplier.contact,
    };
    // Using on_conflict with merge-duplicates will either create a new supplier or return the existing one if the name matches.
    const response = await fetch(`${url}/rest/v1/suppliers?select=*&on_conflict=name`, {
        method: 'POST',
        headers: { ...getHeaders(key), 'Prefer': 'return=representation,resolution=merge-duplicates' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Failed to add or find supplier: ${await response.text()}`);
    const data = await response.json();
    const newSupplierFromDb = data[0];
    return { 
        id: newSupplierFromDb.id,
        name: newSupplierFromDb.name,
        modifiedAt: newSupplierFromDb.modified_at,
        chatId: newSupplierFromDb.chat_id,
        paymentMethod: newSupplierFromDb.payment_method,
        botSettings: newSupplierFromDb.bot_settings,
        contact: newSupplierFromDb.contact,
    };
};

export const updateSupplier = async ({ supplier, url, key }: { supplier: Supplier, url: string, key: string }): Promise<Supplier> => {
    const payload = {
        name: supplier.name,
        chat_id: supplier.chatId,
        payment_method: supplier.paymentMethod,
        bot_settings: supplier.botSettings,
        contact: supplier.contact,
    };
    const response = await fetch(`${url}/rest/v1/suppliers?id=eq.${supplier.id}&select=*`, {
        method: 'PATCH',
        headers: { ...getHeaders(key), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Failed to update supplier: ${await response.text()}`);
    const data = await response.json();
    const updated = data[0];
    return { 
        ...supplier, 
        name: updated.name,
        chatId: updated.chat_id,
        paymentMethod: updated.payment_method,
        modifiedAt: updated.modified_at,
        botSettings: updated.bot_settings,
        contact: updated.contact,
    };
};

export const deleteSupplier = async ({ supplierId, url, key }: { supplierId: string; url: string; key: string }): Promise<void> => {
    const headers = getHeaders(key);
    const response = await fetch(`${url}/rest/v1/suppliers?id=eq.${supplierId}`, {
        method: 'DELETE',
        headers
    });
    if (!response.ok) throw new Error(`Failed to delete supplier: ${await response.text()}`);
};

export const updateStore = async ({ store, url, key }: { store: Store; url: string; key: string }): Promise<Store> => {
    const payload = {
        chat_id: store.chatId,
        location_url: store.locationUrl,
    };
    const response = await fetch(`${url}/rest/v1/stores?id=eq.${store.id}&select=*`, {
        method: 'PATCH',
        headers: { ...getHeaders(key), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Failed to update store: ${await response.text()}`);
    const data = await response.json();
    const updated = data[0];
    return { 
        ...store, 
        chatId: updated.chat_id,
        locationUrl: updated.location_url,
    };
};

export const supabaseUpsertItemPrice = async ({ itemPrice, url, key }: { itemPrice: Omit<ItemPrice, 'id' | 'createdAt'>; url: string; key: string }): Promise<ItemPrice> => {
    const headers = getHeaders(key);

    // 1. Check if a price entry already exists
    const selectUrl = `${url}/rest/v1/item_prices?select=id&item_id=eq.${itemPrice.itemId}&supplier_id=eq.${itemPrice.supplierId}&unit=eq.${itemPrice.unit}`;
    const selectResponse = await fetch(selectUrl, { headers });

    if (!selectResponse.ok) {
        throw new Error(`Failed to check for existing item price: ${await selectResponse.text()}`);
    }

    const existingPrices: { id: string }[] = await selectResponse.json();

    let response;
    if (existingPrices.length > 0) {
        // 2. If exists, UPDATE it using PATCH
        const existingId = existingPrices[0].id;
        const updateUrl = `${url}/rest/v1/item_prices?id=eq.${existingId}&select=*`;
        response = await fetch(updateUrl, {
            method: 'PATCH',
            headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify({
                price: itemPrice.price,
                created_at: new Date().toISOString(), // Update timestamp on every price change
            })
        });
        if (!response.ok) throw new Error(`Failed to update item price: ${await response.text()}`);
    } else {
        // 3. If not, INSERT it using POST
        const insertUrl = `${url}/rest/v1/item_prices?select=*`;
        const payload = {
            item_id: itemPrice.itemId,
            supplier_id: itemPrice.supplierId,
            price: itemPrice.price,
            unit: itemPrice.unit,
        };
        response = await fetch(insertUrl, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Failed to insert item price: ${await response.text()}`);
    }

    const data = await response.json();
    const upsertedPrice = data[0];
    return {
        id: upsertedPrice.id,
        itemId: upsertedPrice.item_id,
        supplierId: upsertedPrice.supplier_id,
        price: upsertedPrice.price,
        unit: upsertedPrice.unit,
        createdAt: upsertedPrice.created_at,
        // FIX: Map is_master from database to isMaster in the application state.
        isMaster: upsertedPrice.is_master,
    };
};

export const upsertDueReportTopUp = async ({ topUp, url, key }: { topUp: DueReportTopUp; url: string; key: string }): Promise<DueReportTopUp> => {
    const headers = { ...getHeaders(key), 'Prefer': 'return=representation,resolution=merge-duplicates' };
    const payload = { date: topUp.date, amount: topUp.amount };
    
    const response = await fetch(`${url}/rest/v1/due_report_top_ups?on_conflict=date`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });
    
    if (!response.ok) throw new Error(`Failed to upsert due report top up: ${await response.text()}`);
    
    const [data] = await response.json();
    return { date: data.date, amount: data.amount };
};

export const addQuickOrder = async ({ quickOrder, url, key }: { quickOrder: Omit<QuickOrder, 'id'>, url: string, key: string }): Promise<QuickOrder> => {
    const payload = {
        name: quickOrder.name,
        store: quickOrder.store,
        supplier_id: quickOrder.supplierId,
        items: quickOrder.items
    };
    const response = await fetch(`${url}/rest/v1/quick_orders?select=*`, {
        method: 'POST',
        headers: { ...getHeaders(key), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Failed to add quick order: ${await response.text()}`);
    const data = await response.json();
    const newQO = data[0];
    return {
        id: newQO.id,
        name: newQO.name,
        store: newQO.store,
        supplierId: newQO.supplier_id,
        supplierName: quickOrder.supplierName,
        items: newQO.items
    };
};

export const deleteQuickOrder = async ({ id, url, key }: { id: string, url: string, key: string }): Promise<void> => {
    const response = await fetch(`${url}/rest/v1/quick_orders?id=eq.${id}`, {
        method: 'DELETE',
        headers: getHeaders(key)
    });
    if (!response.ok) throw new Error(`Failed to delete quick order: ${await response.text()}`);
};


// --- STORAGE OPERATIONS ---
export const uploadFileToStorage = async (
    { bucket, filePath, file, url, key }: { bucket: string; filePath: string; file: Blob; url: string; key: string }
): Promise<{ publicUrl: string }> => {
    const uploadUrl = `${url}/storage/v1/object/${bucket}/${filePath}`;
    const headers = {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': file.type,
    };

    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: file,
    });

    if (!response.ok) {
        throw new Error(`Failed to upload file: ${await response.text()}`);
    }

    const { Key } = await response.json();
    const publicUrl = `${url}/storage/v1/object/public/${Key}`;
    return { publicUrl };
};


// --- SEEDING ---
export const seedDatabase = async ({ url, key, items, suppliers }: { url: string, key: string, items: Item[], suppliers: Supplier[] }) => {
    const headers = {
        ...getHeaders(key),
        'Prefer': 'return=representation,resolution=merge-duplicates',
    };
    
    const supplierPayload = Object.values(SupplierName).map(name => ({ name }));
    const supplierResponse = await fetch(`${url}/rest/v1/suppliers?on_conflict=name`, {
        method: 'POST', headers, body: JSON.stringify(supplierPayload),
    });

    if (!supplierResponse.ok) throw new Error(`Failed to seed suppliers: ${await supplierResponse.text()}`);
    const upsertedSuppliers: {id: string; name: SupplierName}[] = await supplierResponse.json();
    const supplierNameToIdMap = new Map(upsertedSuppliers.map(s => [s.name, s.id]));

    const itemPayload = items
      .filter(item => supplierNameToIdMap.has(item.supplierName))
      .map(item => ({ name: item.name, unit: item.unit, supplier_id: supplierNameToIdMap.get(item.supplierName) }));

    if(itemPayload.length === 0) return { itemsUpserted: 0 };

    const itemResponse = await fetch(`${url}/rest/v1/items?on_conflict=name,supplier_id`, {
        method: 'POST', headers, body: JSON.stringify(itemPayload),
    });

    if (!itemResponse.ok) throw new Error(`Failed to seed items: ${await itemResponse.text()}`);
    const responseData = await itemResponse.json();
    return { itemsUpserted: responseData.length || 0 };
};
