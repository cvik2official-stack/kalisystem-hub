import { Order, SupplierName, StoreName, OrderItem, Unit, ItemPrice } from '../types';

const escapeHtml = (text: string): string => {
  if (typeof text !== 'string') return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

export const renderReceiptTemplate = (template: string, order: Order, itemPrices: ItemPrice[]): string => {
    let grandTotal = 0;

    const itemRows = order.items
        .filter(item => !item.isSpoiled)
        .map(item => {
            const masterPrice = itemPrices.find(p => p.itemId === item.itemId && p.supplierId === order.supplierId && p.isMaster)?.price;
            const price = item.price ?? masterPrice ?? 0;
            const itemTotal = price * item.quantity;
            grandTotal += itemTotal;

            return `
                <tr>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${item.quantity}${escapeHtml(item.unit || '')}</td>
                    <td>${price.toFixed(2)}</td>
                    <td>${itemTotal.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

    let renderedHtml = template;
    renderedHtml = renderedHtml.replace(/{{store}}/g, escapeHtml(order.store));
    renderedHtml = renderedHtml.replace(/{{supplierName}}/g, escapeHtml(order.supplierName));
    renderedHtml = renderedHtml.replace(/{{orderId}}/g, escapeHtml(order.orderId));
    renderedHtml = renderedHtml.replace(/{{date}}/g, new Date(order.completedAt || order.createdAt).toLocaleDateString());
    renderedHtml = renderedHtml.replace(/{{items}}/g, itemRows);
    renderedHtml = renderedHtml.replace(/{{grandTotal}}/g, grandTotal.toFixed(2));
    renderedHtml = renderedHtml.replace(/{{paymentMethod}}/g, escapeHtml(order.paymentMethod?.toUpperCase() || 'N/A'));
    
    return renderedHtml;
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

export const generateReceiptMessage = (order: Order, itemPrices: ItemPrice[]): string => {
    let grandTotal = 0;

    const itemsList = order.items.map(item => {
        // Find price: first from the order item, then fallback to master price list
        const price = item.price ?? itemPrices.find(p => p.itemId === item.itemId && p.supplierId === order.supplierId && p.isMaster)?.price;
        
        const itemName = escapeHtml(item.name);
        const quantityText = `${item.quantity}${item.unit ? escapeHtml(item.unit) : ''}`;
        
        let line = `- ${itemName} (${quantityText})`;

        if (price !== undefined) {
            const itemTotal = price * item.quantity;
            grandTotal += itemTotal;
            line += ` @ $${price.toFixed(2)} = <b>$${itemTotal.toFixed(2)}</b>`;
        }
        return line;
    }).join('\n');

    const header = `🧾 <b>Receipt for Order <code>${escapeHtml(order.orderId)}</code></b>\n` +
                 `<b>Store:</b> ${escapeHtml(order.store)}\n` +
                 `<b>Supplier:</b> ${escapeHtml(order.supplierName)}\n` +
                 `<b>Date:</b> ${new Date(order.completedAt || order.createdAt).toLocaleDateString()}`;

    const footer = `\n---------------------\n` +
                   `<b>Grand Total: $${grandTotal.toFixed(2)}</b>`;

    return `${header}\n\n${itemsList}\n${footer}`;
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

export const generateKaliZapReport = (orders: Order[], itemPrices: ItemPrice[]): string => {
    // 1. Group orders by store
    const ordersByStore = orders.reduce((acc, order) => {
        if (!acc[order.store]) {
            acc[order.store] = [];
        }
        acc[order.store].push(order);
        return acc;
    }, {} as Record<string, Order[]>);

    let totalReportSum = 0;

    // 2. Process each store group
    const storeBlocks = Object.keys(ordersByStore).map(storeName => {
        const storeOrders = ordersByStore[storeName as StoreName];
        
        // 3. Aggregate items within the store
        const aggregatedItems = new Map<string, { name: string; quantity: number; unit?: Unit; itemId: string; supplierId: string }>();
        storeOrders.forEach(order => {
            order.items.forEach(item => {
                if (item.isSpoiled) return; // Exclude spoiled items

                const key = `${item.itemId}-${item.unit}`;
                const existing = aggregatedItems.get(key);

                if (existing) {
                    existing.quantity += item.quantity;
                } else {
                    aggregatedItems.set(key, { 
                        name: item.name, 
                        quantity: item.quantity, 
                        unit: item.unit, 
                        itemId: item.itemId,
                        supplierId: order.supplierId,
                    });
                }
            });
        });

        // 4. Calculate total amount for the store and format item lines
        let storeTotalAmount = 0;
        const itemsListContent: string[] = [];

        Array.from(aggregatedItems.values()).forEach(item => {
            let totalDisplay = '-';
            let unitPriceDisplay = '-';
            
            // Look up the master price from the provided itemPrices array
            let priceInfo: ItemPrice | undefined = undefined;
            if (item.unit) {
                priceInfo = itemPrices.find(p => 
                    p.itemId === item.itemId && 
                    p.supplierId === item.supplierId && 
                    p.unit === item.unit &&
                    p.isMaster
                );
            }
            if (!priceInfo) {
                 priceInfo = itemPrices.find(p => 
                    p.itemId === item.itemId && 
                    p.supplierId === item.supplierId &&
                    p.isMaster
                );
            }

            if (priceInfo) {
                const total = priceInfo.price * item.quantity;
                storeTotalAmount += total;
                totalDisplay = total.toFixed(2);
                unitPriceDisplay = priceInfo.price.toFixed(2);
            }
            
            const nameDisplay = escapeHtml(item.name);
            const quantityDisplay = `${item.quantity}${item.unit ? escapeHtml(item.unit) : ''}`;
            
            // Format: total, item name, unit price, quantity
            itemsListContent.push(`${totalDisplay}, ${nameDisplay}, ${unitPriceDisplay}, ${quantityDisplay}`);
        });
        
        // Accumulate the total for the entire report
        totalReportSum += storeTotalAmount;
        
        // 5. Create the store block
        const storeHeader = `<b>${escapeHtml(storeName)}${storeTotalAmount > 0 ? ` ${storeTotalAmount.toFixed(2)}` : ''}</b>`;
        const itemsList = itemsListContent.join('\n');

        return `${storeHeader}\n${itemsList}`;
    });

    // 6. Get current date and format it
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    // 7. Construct the final report message
    const reportHeader = `Date ${formattedDate}\nEST. report sum ${totalReportSum.toFixed(2)}`;
    const separator = '_________________';
    const existingMessage = storeBlocks.join('\n\n');

    return `${reportHeader}\n${separator}\n${existingMessage}\n${separator}`;
};