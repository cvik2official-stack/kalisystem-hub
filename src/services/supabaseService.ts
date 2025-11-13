import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Store, Supplier, Item, ItemPrice, Order, AppSettings } from '../types';

let supabase: SupabaseClient | null = null;

export const initializeSupabase = (settings: AppSettings) => {
  if (settings.supabaseUrl && settings.supabaseKey) {
    if (!supabase) {
        supabase = createClient(settings.supabaseUrl, settings.supabaseKey);
    }
  }
};

const getSupabase = (): SupabaseClient => {
    if (!supabase) {
        throw new Error("Supabase has not been initialized. Please configure Supabase URL and Key in settings.");
    }
    return supabase;
}

// Stores
export const fetchStores = async (): Promise<Store[]> => {
    const { data, error } = await getSupabase().from('stores').select('*');
    if (error) throw error;
    return data || [];
};

export const upsertStore = async (store: Partial<Store>): Promise<Store> => {
    const { data, error } = await getSupabase().from('stores').upsert(store).select().single();
    if (error) throw error;
    return data;
};

// Suppliers
export const fetchSuppliers = async (): Promise<Supplier[]> => {
    const { data, error } = await getSupabase().from('suppliers').select('*');
    if (error) throw error;
    return data || [];
};

export const upsertSupplier = async (supplier: Partial<Supplier>): Promise<Supplier> => {
    const { data, error } = await getSupabase().from('suppliers').upsert(supplier).select().single();
    if (error) throw error;
    return data;
};

export const deleteSupplier = async (id: string): Promise<void> => {
    const { error } = await getSupabase().from('suppliers').delete().eq('id', id);
    if (error) throw error;
};

// Items
export const fetchItems = async (): Promise<Item[]> => {
    const { data, error } = await getSupabase().from('items').select('*');
    if (error) throw error;
    return data || [];
};

export const upsertItem = async (item: Partial<Item>): Promise<Item> => {
    const { data, error } = await getSupabase().from('items').upsert(item).select().single();
    if (error) throw error;
    return data;
};

export const deleteItem = async (id: string): Promise<void> => {
    await getSupabase().from('item_prices').delete().eq('item_id', id);
    const { error } = await getSupabase().from('items').delete().eq('id', id);
    if (error) throw error;
};

// ItemPrices
export const fetchItemPrices = async (): Promise<ItemPrice[]> => {
    const { data, error } = await getSupabase().from('item_prices').select('*');
    if (error) throw error;
    return data || [];
};

export const upsertItemPrice = async (itemPrice: Partial<ItemPrice>): Promise<ItemPrice> => {
    // Supabase needs snake_case for column names with isMaster
    const { isMaster, ...rest } = itemPrice;
    const priceToUpsert = { ...rest, is_master: isMaster };

    const { data, error } = await getSupabase().from('item_prices').upsert(priceToUpsert).select().single();
    if (error) throw error;
    // And convert back to camelCase
    const { is_master, ...restData } = data;
    return { ...restData, isMaster: is_master };
};


// Orders
export const fetchOrders = async (): Promise<Order[]> => {
    const { data, error } = await getSupabase().from('orders').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    return (data || []).map(o => ({...o, createdAt: o.created_at, modifiedAt: o.modified_at, completedAt: o.completed_at, supplierId: o.supplier_id, supplierName: o.supplier_name, orderId: o.order_id, isSent: o.is_sent, isReceived: o.is_received, invoiceUrl: o.invoice_url, invoiceAmount: o.invoice_amount, paymentMethod: o.payment_method, isAcknowledged: o.is_acknowledged, reminderSentAt: o.reminder_sent_at}));
};

export const upsertOrder = async (order: Partial<Order>): Promise<Order> => {
    // Convert camelCase to snake_case for Supabase
    const { createdAt, modifiedAt, completedAt, supplierId, supplierName, orderId, isSent, isReceived, invoiceUrl, invoiceAmount, paymentMethod, isAcknowledged, reminderSentAt, ...rest } = order;
    const orderForDb = { ...rest, created_at: createdAt, modified_at: modifiedAt, completed_at: completedAt, supplier_id: supplierId, supplier_name: supplierName, order_id: orderId, is_sent: isSent, is_received: isReceived, invoice_url: invoiceUrl, invoice_amount: invoiceAmount, payment_method: paymentMethod, is_acknowledged: isAcknowledged, reminder_sent_at: reminderSentAt };

    const { data, error } = await getSupabase().from('orders').upsert(orderForDb).select().single();
    if (error) throw error;
    
    // Convert snake_case back to camelCase from Supabase
    const { created_at, modified_at, completed_at, supplier_id, supplier_name, order_id, is_sent, is_received, invoice_url, invoice_amount, payment_method, is_acknowledged, reminder_sent_at, ...restData } = data;
    return { ...restData, createdAt: created_at, modifiedAt: modified_at, completedAt: completed_at, supplierId: supplier_id, supplierName: supplier_name, orderId: order_id, isSent: is_sent, isReceived: is_received, invoiceUrl: invoice_url, invoiceAmount: invoice_amount, paymentMethod: payment_method, isAcknowledged: is_acknowledged, reminderSentAt: reminder_sent_at };
};

export const deleteOrder = async (id: string): Promise<void> => {
    const { error } = await getSupabase().from('orders').delete().eq('id', id);
    if (error) throw error;
};

export const upsertOrders = async (orders: Partial<Order>[]): Promise<Order[]> => {
    const ordersForDb = orders.map(order => {
        const { createdAt, modifiedAt, completedAt, supplierId, supplierName, orderId, isSent, isReceived, invoiceUrl, invoiceAmount, paymentMethod, isAcknowledged, reminderSentAt, ...rest } = order;
        return { ...rest, created_at: createdAt, modified_at: modifiedAt, completed_at: completedAt, supplier_id: supplierId, supplier_name: supplierName, order_id: orderId, is_sent: isSent, is_received: isReceived, invoice_url: invoiceUrl, invoice_amount: invoiceAmount, payment_method: paymentMethod, is_acknowledged: isAcknowledged, reminder_sent_at: reminderSentAt };
    });
    
    const { data, error } = await getSupabase().from('orders').upsert(ordersForDb).select();
    if (error) throw error;
    
    return (data || []).map(o => {
        const { created_at, modified_at, completed_at, supplier_id, supplier_name, order_id, is_sent, is_received, invoice_url, invoice_amount, payment_method, is_acknowledged, reminder_sent_at, ...restData } = o;
        return { ...restData, createdAt: created_at, modifiedAt: modified_at, completedAt: completed_at, supplierId: supplier_id, supplierName: supplier_name, orderId: order_id, isSent: is_sent, isReceived: is_received, invoiceUrl: invoice_url, invoiceAmount: invoice_amount, paymentMethod: payment_method, isAcknowledged: is_acknowledged, reminderSentAt: reminder_sent_at };
    });
};
