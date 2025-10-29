import { Item, Order, OrderItem, Supplier, SupplierName } from '../types';

interface SupabaseCredentials {
  url: string;
  key: string;
}

// --- READ OPERATIONS ---

export const getItemsAndSuppliersFromSupabase = async ({ url, key }: SupabaseCredentials): Promise<{ items: Item[], suppliers: Supplier[] }> => {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };

  try {
    const [suppliersResponse, itemsResponse] = await Promise.all([
        fetch(`${url}/rest/v1/suppliers?select=*`, { headers }),
        fetch(`${url}/rest/v1/items?select=*`, { headers })
    ]);

    if (!suppliersResponse.ok) throw new Error(`Failed to fetch suppliers: ${await suppliersResponse.text()}`);
    if (!itemsResponse.ok) throw new Error(`Failed to fetch items: ${await itemsResponse.text()}`);

    const suppliersData: any[] = await suppliersResponse.json();
    const itemsData: any[] = await itemsResponse.json();
    
    const supplierMap = new Map<string, Supplier>(suppliersData.map((s) => [s.id, {
        id: s.id,
        name: s.name,
        telegramGroupId: s.telegram_group_id,
        // FIX: Map modified_at from the database to the Supplier object.
        modifiedAt: s.modified_at,
    }]));
    
    // FIX: Use reduce to filter out items with unknown suppliers, preventing a type error where `supplierName` could be "UNKNOWN".
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

export const getOrdersFromSupabase = async ({ url, key }: SupabaseCredentials): Promise<Order[]> => {
    const headers = { 'apikey': key, 'Authorization': `Bearer ${key}` };
    const response = await fetch(`${url}/rest/v1/orders?select=*,order_items(*)`, { headers });
    if (!response.ok) throw new Error(`Failed to fetch orders: ${await response.text()}`);
    const data: any[] = await response.json();
    
    // Transform the Supabase response (snake_case with nested items) to our app's Order type (camelCase)
    return data.map(order => ({
        id: order.id,
        orderId: order.order_id,
        store: order.store,
        supplierId: order.supplier_id,
        supplierName: order.supplier_name,
        status: order.status,
        isSent: order.is_sent,
        isReceived: order.is_received,
        createdAt: order.created_at,
        modifiedAt: order.modified_at,
        completedAt: order.completed_at,
        items: order.order_items.map((item: any) => ({
            itemId: item.item_id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            isSpoiled: item.is_spoiled,
        })),
    }));
};

// --- WRITE OPERATIONS ---

export const addItem = async ({ item, url, key }: { item: Omit<Item, 'id'>, url: string, key: string }): Promise<Item> => {
    const payload = {
        name: item.name,
        unit: item.unit,
        supplier_id: item.supplierId,
    };
    const response = await fetch(`${url}/rest/v1/items?select=*`, {
        method: 'POST',
        headers: {
            'apikey': key, 'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json', 'Prefer': 'return=representation'
        },
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
        headers: {
            'apikey': key, 'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json', 'Prefer': 'return=representation'
        },
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
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    if (!response.ok) throw new Error(`Failed to delete item: ${await response.text()}`);
};

export const updateSupplier = async ({ supplier, url, key }: { supplier: Supplier, url: string, key: string }): Promise<Supplier> => {
    const payload = { telegram_group_id: supplier.telegramGroupId };
    const response = await fetch(`${url}/rest/v1/suppliers?id=eq.${supplier.id}&select=*`, {
        method: 'PATCH',
        headers: {
            'apikey': key, 'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json', 'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Failed to update supplier: ${await response.text()}`);
    const data = await response.json();
    // FIX: The type `Supplier` now has `modifiedAt`, so this is valid and correctly reflects the updated state.
    return { ...supplier, modifiedAt: data[0].modified_at };
};

// --- SEEDING ---
export const seedDatabase = async ({ url, key, items, suppliers }: { url: string, key: string, items: Item[], suppliers: Supplier[] }) => {
    const headers = {
        'apikey': key, 'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json', 'Prefer': 'return=representation,resolution=merge-duplicates',
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