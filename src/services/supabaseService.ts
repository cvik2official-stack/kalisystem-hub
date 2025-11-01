import { Item, Order, OrderItem, Supplier, SupplierName, StoreName, OrderStatus, Unit } from '../types';

interface SupabaseCredentials {
  url: string;
  key: string;
}

// Interfaces for raw database responses with snake_case properties
interface SupplierFromDb {
  id: string;
  name: SupplierName;
  modified_at: string;
}

interface ItemFromDb {
  id: string;
  name: string;
  unit: Unit;
  supplier_id: string;
  created_at: string;
  modified_at: string;
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
}

interface StoreConfigFromDb {
  store_name: string;
  spreadsheet_id: string | null;
}


const getHeaders = (key: string) => ({
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
});


// --- READ OPERATIONS ---

export const getStoreConfigsFromSupabase = async ({ url, key }: SupabaseCredentials): Promise<{ spreadsheetIds: Record<string, string> }> => {
  const response = await fetch(`${url}/rest/v1/stores_config?select=store_name,spreadsheet_id`, {
    headers: getHeaders(key),
  });

  if (!response.ok) throw new Error(`Failed to fetch store configs: ${await response.text()}`);

  const data: StoreConfigFromDb[] = await response.json();
  const spreadsheetIds: Record<string, string> = {};

  for (const config of data) {
    if (config.spreadsheet_id) {
      spreadsheetIds[config.store_name] = config.spreadsheet_id;
    }
  }

  return { spreadsheetIds };
};


export const getItemsAndSuppliersFromSupabase = async ({ url, key }: SupabaseCredentials): Promise<{ items: Item[], suppliers: Supplier[] }> => {
  const headers = getHeaders(key);

  try {
    const [suppliersResponse, itemsResponse] = await Promise.all([
        fetch(`${url}/rest/v1/suppliers?select=*`, { headers }),
        fetch(`${url}/rest/v1/items?select=*`, { headers })
    ]);

    if (!suppliersResponse.ok) throw new Error(`Failed to fetch suppliers: ${await suppliersResponse.text()}`);
    if (!itemsResponse.ok) throw new Error(`Failed to fetch items: ${await itemsResponse.text()}`);

    const suppliersData: SupplierFromDb[] = await suppliersResponse.json();
    const itemsData: ItemFromDb[] = await itemsResponse.json();
    
    const supplierMap = new Map<string, Supplier>(suppliersData.map((s) => [s.id, {
        id: s.id,
        name: s.name,
        modifiedAt: s.modified_at,
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
            });
        }
        return acc;
    }, []);

    return { items, suppliers: Array.from(supplierMap.values()) };

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
                    // Assume 'items' column exists and is an array of OrderItem or null.
                    items: order.items || [], 
                });
            } else {
                console.warn(`Order with id ${order.id} has an unknown supplier_id ${order.supplier_id}. Skipping.`);
            }
            return acc;
        }, []);
};

// --- WRITE OPERATIONS ---

export const upsertStoreConfigInSupabase = async ({ storeName, spreadsheetId, url, key }: { storeName: string; spreadsheetId: string; url: string; key: string }): Promise<void> => {
  const payload = {
    store_name: storeName,
    spreadsheet_id: spreadsheetId || null,
  };
  
  const response = await fetch(`${url}/rest/v1/stores_config`, {
    method: 'POST',
    headers: { ...getHeaders(key), 'Prefer': 'resolution=merge-duplicates' }, // This is upsert
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Failed to update store config for ${storeName}: ${await response.text()}`);
};

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
        status: order.status,
        is_sent: order.isSent,
        is_received: order.isReceived,
        modified_at: now,
        completed_at: order.completedAt,
        items: order.items,
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
    };
    const response = await fetch(`${url}/rest/v1/items?select=*`, {
        method: 'POST',
        headers: { ...getHeaders(key), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Failed to add item: ${await response.text()}`);
    const data = await response.json();
    const newItem = data[0];
    return { ...item, id: newItem.id, createdAt: newItem.created_at, modifiedAt: newItem.modified_at };
};

export const updateItem = async ({ item, url, key }: { item: Item, url: string, key: string }): Promise<Item> => {
    const payload = {
        name: item.name,
        unit: item.unit,
        supplier_id: item.supplierId,
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

export const addSupplier = async ({ supplierName, url, key }: { supplierName: SupplierName, url: string, key: string }): Promise<Supplier> => {
    const payload = {
        name: supplierName,
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
        modifiedAt: newSupplierFromDb.modified_at
    };
};

export const updateSupplier = async ({ supplier, url, key }: { supplier: Supplier, url: string, key: string }): Promise<Supplier> => {
    const payload = { }; // No editable fields left
    const response = await fetch(`${url}/rest/v1/suppliers?id=eq.${supplier.id}&select=*`, {
        method: 'PATCH',
        headers: { ...getHeaders(key), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Failed to update supplier: ${await response.text()}`);
    const data = await response.json();
    return { ...supplier, modifiedAt: data[0].modified_at };
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