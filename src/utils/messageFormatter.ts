import { Order, SupplierName, StoreName, OrderItem, Unit, ItemPrice, Supplier, Store } from '../types';

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


export const generateOrderMessage = (order: Order, format: 'plain' | 'html', supplier?: Supplier, stores?: Store[]): string => {
    const isHtml = format === 'html';

    // Determine the correct store display name based on supplier and store rules.
    let storeDisplayName: string = order.store;
    if (order.supplierName === SupplierName.P_AND_P && (order.store === StoreName.SHANTI || order.store === StoreName.WB)) {
        storeDisplayName = `STOCKO2 (${order.store})`;
    } else if (order.store === StoreName.SHANTI) {
        // This is the pre-existing special case for SHANTI with other suppliers.
        storeDisplayName = 'STOCKO2 (SHANTI)';
    }

    let finalStoreDisplay = isHtml ? escapeHtml(storeDisplayName) : storeDisplayName;
    if (isHtml && supplier?.botSettings?.includeLocation) {
        const store = stores?.find(s => s.name === order.store);
        if (store?.locationUrl) {
            finalStoreDisplay = `<a href="${escapeHtml(store.locationUrl)}">${finalStoreDisplay}</a>`;
        }
    }

    // KALI supplier has a special, simplified format
    if (order.supplierName === SupplierName.KALI) {
        const header = isHtml ? `<b>${finalStoreDisplay}</b>` : storeDisplayName;
        const itemsList = order.items.map(item => {
            const unitText = item.unit ? (isHtml ? escapeHtml(item.unit) : item.unit) : '';
            const itemName = isHtml ? escapeHtml(item.name) : item.name;
            return `${itemName} x${item.quantity}${unitText}`;
        }).join('\n');
        return `${header}\n${itemsList}`;
    }

    // Default message format for all other suppliers
    const header = isHtml
        ? `<b>#️⃣ Order ${escapeHtml(order.orderId)}</b>\n🚚 Delivery order\n📌 <b>${finalStoreDisplay}</b>\n\n`
        : `#️⃣ Order ${order.orderId}\n🚚 Delivery order\n📌 ${storeDisplayName}\n\n`;
    
    const itemsList = order.items.map(item => {
        const unitText = item.unit ? ` ${isHtml ? escapeHtml(item.unit) : item.unit}` : '';
        // Removed italic formatting from item name for HTML messages
        const itemName = isHtml ? escapeHtml(item.name) : item.name;
        return `${itemName} x${item.quantity}${unitText}`;
    }).join('\n');

    let message = `${header}${itemsList}`;

    if (order.supplierName === SupplierName.OUDOM) {
        const oudomFooterPlain = `Please approve and mark as done from the app:\nOUDOM TASKS hyperlink: https://kalisystem-hub.vercel.app/?view=manager&store=OUDOM`;
        const oudomFooterHtml = `Please approve and mark as done from the app:\n<a href="https://kalisystem-hub.vercel.app/?view=manager&store=OUDOM">OUDOM TASKS</a>`;
        message += `\n\n${isHtml ? oudomFooterHtml : oudomFooterPlain}`;
    }

    return message;
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

export const generateKaliUnifyReport = (orders: Order[], itemPrices: ItemPrice[], previousDue: number, topUp: number): string => {
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    const topDue = previousDue;
    const topTopup = topUp;
    const topTotal = topDue + topTopup;

    let message = `Date ${formattedDate}\n`;
    message += `Due: ${topDue.toFixed(2)}\n`;
    message += `Topup: ${topTopup.toFixed(2)}\n`;
    message += `Total: ${topTotal.toFixed(2)}\n`;
    message += `__________________\n`;

    const ordersByStore = orders.reduce((acc, order) => {
        if (!acc[order.store]) {
            acc[order.store] = [];
        }
        acc[order.store].push(order);
        return acc;
    }, {} as Record<string, Order[]>);

    let totalSpendings = 0;
    const storeBlocks: string[] = [];

    // Calculate totals and details for each store
    for (const storeName in ordersByStore) {
        const storeOrders = ordersByStore[storeName];
        if (storeOrders.length === 0) continue;

        let storeTotalAmount = 0;
        
        // Aggregate items to handle multiple orders from the same supplier (KALI) to the same store
        const aggregatedItems = new Map<string, { name: string; quantity: number; unit?: Unit, price: number }>();

        storeOrders.forEach(order => {
            order.items.forEach(item => {
                if (item.isSpoiled) return;
                
                const price = item.price ?? itemPrices.find(p => p.itemId === item.itemId && p.supplierId === order.supplierId && p.isMaster)?.price ?? 0;
                
                const key = `${item.itemId}-${item.unit || 'none'}`; // Key by item and unit to be safe
                const existing = aggregatedItems.get(key);

                if (existing) {
                    const existingTotalValue = existing.price * existing.quantity;
                    const newItemTotalValue = price * item.quantity;
                    const newTotalQuantity = existing.quantity + item.quantity;
                    
                    existing.quantity = newTotalQuantity;
                    if (newTotalQuantity > 0) {
                        // Recalculate weighted average price
                        existing.price = (existingTotalValue + newItemTotalValue) / newTotalQuantity;
                    }
                } else {
                    aggregatedItems.set(key, { name: item.name, quantity: item.quantity, unit: item.unit, price: price });
                }
            });
        });
        
        let storeItemDetails = '';
        const sortedItems = Array.from(aggregatedItems.values()).sort((a,b) => a.name.localeCompare(b.name));

        sortedItems.forEach(item => {
            const itemTotal = item.price * item.quantity;
            storeTotalAmount += itemTotal;
            const unitDisplay = item.unit ? item.unit : '';
            storeItemDetails += `${item.name} x${item.quantity}${unitDisplay} @ ${item.price.toFixed(2)} = ${itemTotal.toFixed(2)}\n`;
        });

        if (storeTotalAmount > 0) {
            totalSpendings += storeTotalAmount;
            const storeHeader = `${storeName} (${storeTotalAmount.toFixed(2)})\n`;
            storeBlocks.push(storeHeader + storeItemDetails);
        }
    }

    // Build the store summary section of the message
    if (storeBlocks.length > 0) {
        message += storeBlocks.join('__________________\n');
    }
    
    message += `__________________\n`;

    // Build the footer section
    message += `Total: ${topTotal.toFixed(2)}\n`;
    message += `Spendings: ${totalSpendings.toFixed(2)}\n`;
    
    const newDue = topTotal - totalSpendings;
    message += `New Due: ${newDue.toFixed(2)}\n`;

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

export const generateStoreReport = (orders: Order[]): string => {
    const aggregatedItems = new Map<string, { name: string; totalQuantity: number; unit?: Unit; totalValue: number; priceEntries: number[] }>();

    for (const order of orders) {
        for (const item of order.items) {
            if (item.isSpoiled) continue;

            const key = `${item.itemId}-${item.unit || 'none'}`;
            const existing = aggregatedItems.get(key);
            
            const price = item.price || 0;
            const itemValue = price * item.quantity;

            if (existing) {
                existing.totalQuantity += item.quantity;
                existing.totalValue += itemValue;
                if (price > 0) existing.priceEntries.push(price);
            } else {
                aggregatedItems.set(key, {
                    name: item.name,
                    totalQuantity: item.quantity,
                    unit: item.unit,
                    totalValue: itemValue,
                    priceEntries: price > 0 ? [price] : [],
                });
            }
        }
    }

    if (aggregatedItems.size === 0) {
        return "No items in today's completed orders.";
    }

    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
    const storeName = orders[0]?.store || 'Store';

    let report = `STORE REPORT: ${storeName} - ${formattedDate}\n`;
    report += "========================================\n\n";

    let grandTotal = 0;
    const sortedItems = Array.from(aggregatedItems.values()).sort((a, b) => a.name.localeCompare(b.name));

    for (const item of sortedItems) {
        grandTotal += item.totalValue;
        const avgPrice = item.priceEntries.length > 0 ? item.priceEntries.reduce((a, b) => a + b, 0) / item.priceEntries.length : 0;
        
        const name = item.name.padEnd(20, ' ');
        const quantity = `${item.totalQuantity}${item.unit || ''}`.padStart(8, ' ');
        const price = `@ ${avgPrice.toFixed(2)}`.padStart(10, ' ');
        const total = `$${item.totalValue.toFixed(2)}`.padStart(12, ' ');

        report += `${name}${quantity}${price}${total}\n`;
    }

    report += "\n========================================\n";
    report += `GRAND TOTAL: $${grandTotal.toFixed(2)}\n`;

    return report;
};