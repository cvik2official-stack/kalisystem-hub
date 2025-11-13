import { Order, SupplierName, StoreName, OrderItem, Unit, ItemPrice, Supplier, Store, AppSettings, PaymentMethod } from '../types';

export const escapeHtml = (text: string): string => {
  if (typeof text !== 'string') return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

export const getLatestItemPrice = (itemId: string, supplierId: string, itemPrices: ItemPrice[]): ItemPrice | undefined => {
    return itemPrices
        .filter(p => p.itemId === itemId && p.supplierId === supplierId)
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0];
};

export const replacePlaceholders = (template: string, replacements: Record<string, string>): string => {
    let result = template;
    for (const key in replacements) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), replacements[key]);
    }
    return result;
};

// --- START: UNIFIED REPORTING LOGIC ---

/**
 * A centralized, private utility for generating the body of an aggregated items report.
 * This handles the complex logic of grouping, aggregating items, calculating totals,
 * and formatting the final text block.
 * @private
 */
const _generateAggregatedItemsReport = (
    orders: Order[],
    itemPrices: ItemPrice[],
    groupBy: 'store' | 'supplier'
): { reportBody: string; totalSpendings: number } => {
    
    const groupMap = new Map<string, { total: number; items: Map<string, { name: string; quantity: number; unit?: Unit; totalValue: number; priceEntries: number[] }> }>();

    for (const order of orders) {
        const key = groupBy === 'store' ? order.store : order.supplierName;
        if (!groupMap.has(key)) {
            groupMap.set(key, { total: 0, items: new Map() });
        }
        const group = groupMap.get(key)!;

        for (const item of order.items) {
            if (item.isSpoiled) continue;

            const latestPrice = getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price;
            const price = item.price ?? latestPrice ?? 0;
            const itemValue = price * item.quantity;
            group.total += itemValue;

            const itemKey = `${item.itemId}-${item.unit || 'none'}`;
            const existingItem = group.items.get(itemKey);

            if (existingItem) {
                existingItem.quantity += item.quantity;
                existingItem.totalValue += itemValue;
                if (price > 0) existingItem.priceEntries.push(price);
            } else {
                group.items.set(itemKey, {
                    name: item.name,
                    quantity: item.quantity,
                    unit: item.unit,
                    totalValue: itemValue,
                    priceEntries: price > 0 ? [price] : [],
                });
            }
        }
    }

    const totalSpendings = Array.from(groupMap.values()).reduce((acc, group) => acc + group.total, 0);
    const sortedGroupKeys = Array.from(groupMap.keys()).sort((a, b) => a.localeCompare(b));
    const groupBlocks: string[] = [];

    for (const key of sortedGroupKeys) {
        const group = groupMap.get(key)!;
        if (group.total <= 0) continue;

        let block = `${key} (${group.total.toFixed(2)})\n`;
        const sortedItems = Array.from(group.items.values()).sort((a,b) => a.name.localeCompare(b.name));

        for (const item of sortedItems) {
            const avgPrice = item.priceEntries.length > 0 ? item.priceEntries.reduce((a, b) => a + b, 0) / item.priceEntries.length : 0;
            const unitDisplay = item.unit || '';
            
            // New columnar format for better alignment
            const namePart = item.name.padEnd(20, ' ').substring(0, 20);
            const qtyPart = `${item.quantity}${unitDisplay}`.padStart(7);
            const pricePart = `@ ${avgPrice.toFixed(2)}`.padStart(8);
            const totalPart = item.totalValue.toFixed(2).padStart(8);
            block += `${namePart} ${qtyPart} ${pricePart} ${totalPart}\n`;
        }
        groupBlocks.push(block);
    }
    
    return {
        reportBody: groupBlocks.join('__________________\n'),
        totalSpendings,
    };
};

// --- END: UNIFIED REPORTING LOGIC ---


export const renderReceiptTemplate = (template: string, order: Order, itemPrices: ItemPrice[]): string => {
    let grandTotal = 0;

    const itemRows = order.items
        .filter(item => !item.isSpoiled)
        .map(item => {
            const latestPrice = getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price;
            const price = item.price ?? latestPrice ?? 0;
            const itemTotal = price * item.quantity;
            grandTotal += itemTotal;

            if (price > 0) {
              return `
                  <tr>
                      <td>${escapeHtml(item.name)}</td>
                      <td style="text-align: right;">${item.quantity}${escapeHtml(item.unit || '')}</td>
                      <td style="text-align: right;">${price.toFixed(2)}</td>
                      <td style="text-align: right;">${itemTotal.toFixed(2)}</td>
                  </tr>
              `;
            } else {
               return `
                  <tr>
                      <td>${escapeHtml(item.name)}</td>
                      <td style="text-align: right;">${item.quantity}${escapeHtml(item.unit || '')}</td>
                      <td></td>
                      <td></td>
                  </tr>
              `;
            }
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


export const generateOrderMessage = (order: Order, format: 'plain' | 'html', allSuppliers: Supplier[], stores: Store[] | undefined, settings: AppSettings): string => {
    const supplier = allSuppliers.find(s => s.id === order.supplierId);
    const isHtml = format === 'html';
    const templates = settings.messageTemplates || {};

    let template = supplier?.botSettings?.messageTemplate;
    if (!template) {
        switch (supplier?.name) {
            case SupplierName.KALI:
                template = templates.kaliOrder;
                break;
            case SupplierName.OUDOM:
                template = templates.oudomOrder;
                break;
            default:
                template = templates.defaultOrder;
        }
    }

    // Fallback to original hardcoded logic if no template is found
    if (!template) {
        // This block is now a fallback and should mirror the original logic
        let storeDisplayName: string = order.store;
        if (order.supplierName === SupplierName.P_AND_P && (order.store === StoreName.SHANTI || order.store === StoreName.WB)) {
            storeDisplayName = `STOCKO2 (${order.store})`;
        } else if (order.store === StoreName.SHANTI) {
            storeDisplayName = 'STOCKO2 (SHANTI)';
        }

        let finalStoreDisplay = isHtml ? escapeHtml(storeDisplayName) : storeDisplayName;
        if (isHtml && supplier?.botSettings?.includeLocation && stores) {
            const store = stores.find(s => s.name === order.store);
            if (store && store.locationUrl) {
                finalStoreDisplay = `<a href="${escapeHtml(store.locationUrl)}">${finalStoreDisplay}</a>`;
            }
        }

        if (order.supplierName === SupplierName.KALI) {
            let header = isHtml ? `<b>${finalStoreDisplay}</b>` : storeDisplayName;
            if (supplier?.contact) {
                header += `\n📱 ${isHtml ? escapeHtml(supplier.contact) : supplier.contact}`;
            }
            const itemsList = order.items.map(item => `${isHtml ? escapeHtml(item.name) : item.name} x${item.quantity}${item.unit || ''}`).join('\n');
            return `${header}\n${itemsList}`;
        }

        let header = isHtml
            ? `<b>#️⃣ Order ${escapeHtml(order.orderId)}</b>\n🚚 Delivery order\n📌 <b>${finalStoreDisplay}</b>`
            : `#️⃣ Order ${order.orderId}\n🚚 Delivery order\n📌 ${storeDisplayName}`;
        
        if (supplier?.contact) {
            header += `\n📱 ${isHtml ? escapeHtml(supplier.contact) : supplier.contact}`;
        }

        header += `\n\n`; // Add the separator
        
        const itemsList = order.items.map(item => `${isHtml ? escapeHtml(item.name) : item.name} x${item.quantity}${item.unit ? ` ${item.unit}` : ''}`).join('\n');

        let message = `${header}${itemsList}`;

        if (order.supplierName === SupplierName.OUDOM) {
            const oudomFooter = isHtml ? `\n\nPlease approve and mark as done from the app:\n<a href="https://kalisystem-hub.vercel.app/?view=manager&store=OUDOM">OUDOM TASKS</a>` : `\n\nPlease approve and mark as done from the app:\nOUDOM TASKS hyperlink: https://kalisystem-hub.vercel.app/?view=manager&store=OUDOM`;
            message += oudomFooter;
        }

        return message;
    }

    // --- Template-based rendering ---
    let storeDisplayName: string = order.store;
    if (order.supplierName === SupplierName.P_AND_P && (order.store === StoreName.SHANTI || order.store === StoreName.WB)) {
        storeDisplayName = `STOCKO2 (${order.store})`;
    } else if (order.store === StoreName.SHANTI) {
        storeDisplayName = 'STOCKO2 (SHANTI)';
    }

    let finalStoreDisplay = isHtml ? escapeHtml(storeDisplayName) : storeDisplayName;
    if (isHtml && supplier?.botSettings?.includeLocation && stores) {
        const store = stores.find(s => s.name === order.store);
        if (store && store.locationUrl) {
            finalStoreDisplay = `<a href="${escapeHtml(store.locationUrl)}">${finalStoreDisplay}</a>`;
        }
    }
    
    const itemsList = order.items.map(item => {
        const name = isHtml ? escapeHtml(item.name) : item.name;
        const unit = item.unit ? (isHtml ? ` ${escapeHtml(item.unit)}` : ` ${item.unit}`) : '';
        return `${name} x${item.quantity}${unit}`;
    }).join('\n');

    const replacements = {
        orderId: isHtml ? escapeHtml(order.orderId) : order.orderId,
        storeName: finalStoreDisplay,
        items: itemsList
    };

    let finalTemplate = template;
    if (supplier?.contact) {
        const contactLine = `\n📱 ${isHtml ? escapeHtml(supplier.contact) : supplier.contact}`;
        // Insert the contact line just before the items placeholder.
        // This regex looks for one or two newlines before {{items}} to handle different template structures.
        finalTemplate = finalTemplate.replace(/(\n\n?{{items}})/, `${contactLine}$1`);
    }

    let message = replacePlaceholders(finalTemplate, replacements);
    if (!isHtml) {
        // Strip HTML tags for plain text format
        message = message.replace(/<[^>]*>?/gm, '');
    }

    return message;
};


export const generateReceiptMessage = (order: Order, itemPrices: ItemPrice[], settings: AppSettings): string => {
    const template = settings.messageTemplates?.telegramReceipt;
    let grandTotal = 0;

    const itemsList = order.items.map(item => {
        const latestPrice = getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price;
        const price = item.price ?? latestPrice;
        const itemName = item.name;
        const quantityText = `${item.quantity}${item.unit || ''}`;
        
        let line = `- ${itemName} (${quantityText})`;

        if (price !== undefined) {
            const itemTotal = price * item.quantity;
            grandTotal += itemTotal;
            line += ` @ ${price.toFixed(2)} = ${itemTotal.toFixed(2)}`;
        }
        return line;
    }).join('\n');

    if (!template) {
        // Fallback to hardcoded version if template is missing
        const header = `🧾 <b>Receipt for Order <code>${escapeHtml(order.orderId)}</code></b>\n` +
                 `<b>Store:</b> ${escapeHtml(order.store)}\n` +
                 `<b>Supplier:</b> ${escapeHtml(order.supplierName)}\n` +
                 `<b>Date:</b> ${new Date(order.completedAt || order.createdAt).toLocaleDateString()}`;

        const footer = `\n---------------------\n` +
                       `<b>Grand Total: ${grandTotal.toFixed(2)}</b>`;

        return `${header}\n\n${itemsList} \n${footer}`;
    }

    const replacements = {
        orderId: order.orderId,
        store: order.store,
        supplierName: order.supplierName,
        date: new Date(order.completedAt || order.createdAt).toLocaleDateString(),
        items: itemsList,
        grandTotal: `${grandTotal.toFixed(2)}`
    };

    let message = replacePlaceholders(template, replacements);
    
    return message;
};

export const generateKaliUnifyReport = (orders: Order[], itemPrices: ItemPrice[], previousDue: number, topUp: number): string => {
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    const topTotal = previousDue + topUp;

    let message = `Date ${formattedDate}\n`;
    message += `Due: ${previousDue.toFixed(2)}\n`;
    message += `Topup: ${topUp.toFixed(2)}\n`;
    message += `Total: ${topTotal.toFixed(2)}\n`;
    message += `__________________\n`;

    const { reportBody, totalSpendings } = _generateAggregatedItemsReport(orders, itemPrices, 'store');
    
    if (reportBody) {
        message += reportBody + '\n';
    }
    
    message += `__________________\n`;
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
            
            const priceInfo = getLatestItemPrice(item.itemId, item.supplierId, itemPrices);

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
        const total = `${item.totalValue.toFixed(2)}`.padStart(12, ' ');

        report += `${name}${quantity}${price}${total}\n`;
    }

    report += "\n========================================\n";
    report += `GRAND TOTAL: ${grandTotal.toFixed(2)}\n`;

    return report;
};

export const generateDueReportMessage = (orders: Order[], itemPrices: ItemPrice[], sortBy: 'store' | 'supplier', previousDue: number, topUp: number): string => {
    if (orders.length === 0) return "No orders for this date.";

    const dateFromOrder = new Date(orders[0].completedAt || orders[0].createdAt);
    const formattedDate = `${String(dateFromOrder.getDate()).padStart(2, '0')}.${String(dateFromOrder.getMonth() + 1).padStart(2, '0')}.${String(dateFromOrder.getFullYear()).slice(-2)}`;
    
    const totalDue = previousDue + topUp;
    
    let message = `${formattedDate}\n`;
    message += `Due: ${previousDue.toFixed(2)}\n`;
    message += `Topup: ${topUp.toFixed(2)}\n`;
    message += `Total: ${totalDue.toFixed(2)}\n`;
    message += `__________________\n`;

    const { reportBody, totalSpendings } = _generateAggregatedItemsReport(orders, itemPrices, sortBy);

    if (reportBody) {
        message += reportBody + '\n';
    }
    
    message += `__________________\n`;
    message += `Total: ${totalDue.toFixed(2)}\n`;
    message += `Spendings: ${totalSpendings.toFixed(2)}\n`;
    
    const newDue = totalDue - totalSpendings;
    message += `New Due: ${newDue.toFixed(2)}\n`;

    return message;
};

export const generateConsolidatedReceipt = (
    orders: Order[],
    itemPrices: ItemPrice[],
    suppliers: Supplier[],
    format: 'plain' | 'html',
    options: { showPaymentMethods: Set<string> }
): string => {
    if (orders.length === 0) return "No orders to display for the selected filters.";

    const isHtml = format === 'html';
    const storeName = orders[0].store;
    const date = new Date(orders[0].completedAt || orders[0].createdAt);
    const formattedDate = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getFullYear()).slice(-2)}`;

    const ordersBySupplier = new Map<string, { name: SupplierName; items: Map<string, { name: string; quantity: number; unit?: Unit; totalValue: number; priceEntries: number[] }> }>();
    let grandTotal = 0;
    const paymentSubtotals = new Map<string, number>();

    for (const order of orders) {
        // FIX: Use the passed 'suppliers' array instead of a non-existent 'state' object.
        const supplier = suppliers.find(s => s.id === order.supplierId);
        const paymentMethod = order.paymentMethod || supplier?.paymentMethod;

        if (!ordersBySupplier.has(order.supplierId)) {
            ordersBySupplier.set(order.supplierId, { name: order.supplierName, items: new Map() });
        }
        const supplierGroup = ordersBySupplier.get(order.supplierId)!;

        for (const item of order.items) {
            if (item.isSpoiled) continue;
            
            const latestPrice = getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price;
            const price = item.price ?? latestPrice ?? 0;
            const itemValue = price * item.quantity;
            grandTotal += itemValue;

            if (paymentMethod) {
                const currentSubtotal = paymentSubtotals.get(paymentMethod) || 0;
                paymentSubtotals.set(paymentMethod, currentSubtotal + itemValue);
            }

            const itemKey = `${item.itemId}-${item.unit || 'none'}`;
            const existingItem = supplierGroup.items.get(itemKey);

            if (existingItem) {
                existingItem.quantity += item.quantity;
                existingItem.totalValue += itemValue;
                if (price > 0) existingItem.priceEntries.push(price);
            } else {
                supplierGroup.items.set(itemKey, { name: item.name, quantity: item.quantity, unit: item.unit, totalValue: itemValue, priceEntries: price > 0 ? [price] : [] });
            }
        }
    }

    const h = (text: string) => isHtml ? escapeHtml(text) : text;
    const b = (text: string) => isHtml ? `<b>${h(text)}</b>` : text;
    const separator = isHtml ? '<hr style="border-style: dashed;">\n' : '----------------------------------------\n';

    let result = `${b('Buy & Dispatch.')}\n`;
    result += `${b('Store:')} ${h(storeName)}\n`;
    result += `${b('Date:')} ${h(formattedDate)}\n`;
    result += separator;

    const sortedSuppliers = Array.from(ordersBySupplier.values()).sort((a,b) => a.name.localeCompare(b.name));

    if (isHtml) {
        result += `<table style="width: 100%; border-collapse: collapse;">`;
    }

    for (const supplier of sortedSuppliers) {
        const supplierTotal = Array.from(supplier.items.values()).reduce((sum, item) => sum + item.totalValue, 0);
        result += isHtml ? `<tr><td colspan="4" style="padding-top: 8px;"><b>${h(supplier.name)} - ${supplierTotal.toFixed(2)}</b></td></tr>` : `\n${supplier.name} - ${supplierTotal.toFixed(2)}\n`;
        const sortedItems = Array.from(supplier.items.values()).sort((a,b) => a.name.localeCompare(b.name));
        
        for (const item of sortedItems) {
            const avgPrice = item.priceEntries.length > 0 ? item.priceEntries.reduce((a, b) => a + b, 0) / item.priceEntries.length : 0;
            const unit = item.unit || '';
            
            if (avgPrice > 0 || item.totalValue > 0) {
                if (isHtml) {
                    result += `<tr><td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${h(item.name)}</td><td style="text-align: right;">${item.quantity}${unit}</td><td style="text-align: right;">@ ${avgPrice.toFixed(2)}</td><td style="text-align: right;"><b>${item.totalValue.toFixed(2)}</b></td></tr>`;
                } else {
                    const namePart = item.name.padEnd(18, ' ').substring(0, 18);
                    const qtyPart = `${item.quantity}${unit}`.padStart(6);
                    const pricePart = `@${avgPrice.toFixed(2)}`.padStart(7);
                    const totalPart = item.totalValue.toFixed(2).padStart(8);
                    result += `${namePart} ${qtyPart} ${pricePart} ${totalPart}\n`;
                }
            } else {
                if (isHtml) {
                    result += `<tr><td>${h(item.name)}</td><td style="text-align: right;">${item.quantity}${unit}</td><td></td><td></td></tr>`;
                } else {
                    const namePart = item.name.padEnd(18, ' ').substring(0, 18);
                    const qtyPart = `${item.quantity}${unit}`.padStart(6);
                    result += `${namePart} ${qtyPart}\n`;
                }
            }
        }
    }
    
    if (isHtml) {
        result += `</table>`;
    }

    if (paymentSubtotals.size > 0) {
        result += `\n${separator}`;
        for (const [method, total] of paymentSubtotals.entries()) {
            if (options.showPaymentMethods.has(method)) {
                if (isHtml) {
                    result += `<div><span>${b(h(method.toUpperCase()) + ' TOTAL:')}</span><span style="float: right;">${b(total.toFixed(2))}</span></div>\n`;
                } else {
                    result += `${(method.toUpperCase() + ' TOTAL:').padEnd(31)}${total.toFixed(2).padStart(8)}\n`;
                }
            }
        }
    }

    result += `\n${separator}`;
    if (isHtml) {
        result += `<div><span style="font-size: 1.1em;">${b('GRAND TOTAL:')}</span><span style="font-size: 1.1em; float: right;">${b(grandTotal.toFixed(2))}</span></div>`;
    } else {
        result += `${'GRAND TOTAL:'.padEnd(31)}${grandTotal.toFixed(2).padStart(8)}\n`;
    }
    
    if(isHtml){
        return `<div style="font-family: 'Courier New', Courier, monospace; font-size: 12px; max-width: 300px; padding: 8px; background: white; color: black;">${result.replace(/\n/g, '<br>')}</div>`;
    }

    return result;
};
