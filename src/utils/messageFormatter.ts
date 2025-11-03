import { Order, SupplierName, StoreName, OrderItem, Unit } from '../types';

const escapeHtml = (text: string): string => {
  if (typeof text !== 'string') return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

export const generateOrderMessage = (order: Order, format: 'plain' | 'html'): string => {
    const isHtml = format === 'html';

    // Special handling for the SHANTI store name display
    const storeDisplayName = order.store === StoreName.SHANTI ? 'STOCKO2 (SHANTI)' : order.store;

    // KALI supplier has a special, simplified format
    if (order.supplierName === SupplierName.KALI) {
        const header = isHtml ? `<b>${escapeHtml(storeDisplayName)}</b>` : storeDisplayName;
        const itemsList = order.items.map(item => {
            const unitText = item.unit ? (isHtml ? escapeHtml(item.unit) : item.unit) : '';
            const itemName = isHtml ? escapeHtml(item.name) : item.name;
            return `${itemName} x${item.quantity}${unitText}`;
        }).join('\n');
        return `${header}\n${itemsList}`;
    }

    // Default message format for all other suppliers
    const header = isHtml
        ? `<b>#️⃣ Order ${escapeHtml(order.orderId)}</b>\n🚚 Delivery order\n📌 <b>${escapeHtml(storeDisplayName)}</b>\n\n`
        : `#️⃣ Order ${order.orderId}\n🚚 Delivery order\n📌 ${storeDisplayName}\n\n`;
    
    const itemsList = order.items.map(item => {
        const unitText = item.unit ? ` ${isHtml ? escapeHtml(item.unit) : item.unit}` : '';
        // Removed italic formatting from item name for HTML messages
        const itemName = isHtml ? escapeHtml(item.name) : item.name;
        return `${itemName} x${item.quantity}${unitText}`;
    }).join('\n');

    return `${header}${itemsList}`;
};

export const generateKaliUnifyReport = (orders: Order[]): string => {
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    const topDue = 0;
    const topTopup = 0;
    const topTotal = topDue + topTopup;

    let message = `Date ${formattedDate}\n`;
    message += `Due: ${topDue}\n`;
    message += `Topup: ${topTopup}\n`;
    message += `Total: ${topTotal}\n`;
    message += `__________________\n`;

    const ordersByStore = orders.reduce((acc, order) => {
        if (!acc[order.store]) {
            acc[order.store] = [];
        }
        acc[order.store].push(order);
        return acc;
    }, {} as Record<string, Order[]>);

    let totalDue = 0;
    let allInvoicesSet = true;

    for (const storeName in ordersByStore) {
        const storeOrders = ordersByStore[storeName];
        if (storeOrders.length === 0) continue;

        const storeInvoiceTotal = storeOrders.reduce((sum, order) => sum + (order.invoiceAmount || 0), 0);
        totalDue += storeInvoiceTotal;

        if (storeOrders.some(order => order.invoiceAmount == null || order.invoiceAmount === 0)) {
            allInvoicesSet = false;
        }

        const invoiceDisplay = storeInvoiceTotal > 0 ? ` (${storeInvoiceTotal.toFixed(2)})` : '';
        message += `${storeName}${invoiceDisplay}\n`;

        const allItems = storeOrders.flatMap(order => order.items);
        for (const item of allItems) {
            message += `${item.name} x${item.quantity}${item.unit || ''}\n`;
        }
        message += `__________________\n`;
    }

    const spendings = totalDue;

    message += `Due: ${totalDue.toFixed(2)}\n`;
    message += `Spendings: ${spendings.toFixed(2)}\n`;
    
    if (allInvoicesSet) {
        const newDue = topDue - spendings; // Initial calculation based on app data
        message += `New Due: ${newDue.toFixed(2)}\n`;
    }

    return message;
};

export const generateKaliZapReport = (orders: Order[]): string => {
    // 1. Group orders by store
    const ordersByStore = orders.reduce((acc, order) => {
        if (!acc[order.store]) {
            acc[order.store] = [];
        }
        acc[order.store].push(order);
        return acc;
    }, {} as Record<string, Order[]>);

    // 2. Process each store group
    const storeBlocks = Object.keys(ordersByStore).map(storeName => {
        const storeOrders = ordersByStore[storeName as StoreName];
        
        // 3. Aggregate items within the store
        const aggregatedItems = new Map<string, { name: string; quantity: number; unit?: Unit }>();
        storeOrders.forEach(order => {
            order.items.forEach(item => {
                if (aggregatedItems.has(item.itemId)) {
                    aggregatedItems.get(item.itemId)!.quantity += item.quantity;
                } else {
                    // Create a copy to avoid mutating the original item
                    aggregatedItems.set(item.itemId, { name: item.name, quantity: item.quantity, unit: item.unit });
                }
            });
        });

        // 4. Format the item list for the store
        const itemsList = Array.from(aggregatedItems.values()).map(item => {
            const unitText = item.unit ? escapeHtml(item.unit) : '';
            return `${escapeHtml(item.name)} x${item.quantity}${unitText}`;
        }).join('\n');
        
        // 5. Create the store block
        return `<b>${escapeHtml(storeName)}</b>\n${itemsList}`;
    });

    // 6. Join blocks and return
    return storeBlocks.join('\n\n');
};