import { Order, OrderItem, ItemPrice, Supplier, Store, AppSettings, StoreName, PaymentMethod, SupplierName, Unit } from '../types';

// Simple HTML escaper
export const escapeHtml = (unsafe: string): string => {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

// Generic placeholder replacer
export const replacePlaceholders = (template: string, replacements: Record<string, string | number>): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
        return replacements[key]?.toString() ?? placeholder;
    });
};

// Get the latest/master price for an item
export const getLatestItemPrice = (itemId: string, supplierId: string, itemPrices: ItemPrice[]): ItemPrice | undefined => {
    const prices = itemPrices.filter(p => p.itemId === itemId && p.supplierId === supplierId);
    if (prices.length === 0) return undefined;
    // Prefer master price, otherwise take the most recent one.
    const masterPrice = prices.find(p => p.isMaster);
    if (masterPrice) return masterPrice;
    return prices.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0];
};

const formatPrice = (price: number): string => price.toFixed(2);

// Generate order message for Telegram
export const generateOrderMessage = (order: Order, format: 'html' | 'plain', suppliers: Supplier[], stores: Store[], settings: AppSettings): string => {
    const supplier = suppliers.find(s => s.id === order.supplierId);
    const store = stores.find(s => s.name === order.store);
    const templates = settings.messageTemplates || {};

    let templateKey = 'defaultOrder';
    if (supplier?.name === SupplierName.KALI) templateKey = 'kaliOrder';
    if (supplier?.name === SupplierName.OUDOM) templateKey = 'oudomOrder';
    
    const template = supplier?.botSettings?.messageTemplate || templates[templateKey] || 'Order {{orderId}} for {{storeName}}\n{{items}}';

    const itemsList = order.items.map(item => {
        const line = `${item.name} x${item.quantity}${item.unit ? ` ${item.unit}` : ''}`;
        return format === 'html' ? `${escapeHtml(line)}` : `${line}`;
    }).join('\n');
    
    // FIX: Explicitly type storeNameDisplay as a string to allow assigning HTML content.
    let storeNameDisplay: string = order.store;
    if (format === 'html' && (supplier?.botSettings?.includeLocation || supplier?.botSettings?.includeLocation === undefined && store?.locationUrl) && store?.locationUrl) {
        storeNameDisplay = `<a href="${escapeHtml(store.locationUrl)}">${escapeHtml(order.store)}</a>`;
    } else if(format === 'html') {
        storeNameDisplay = escapeHtml(order.store);
    }

    const replacements = {
        orderId: format === 'html' ? `<code>${escapeHtml(order.orderId)}</code>` : order.orderId,
        storeName: storeNameDisplay,
        items: itemsList,
    };
    
    return replacePlaceholders(template, replacements);
};


// Generate a simple text report for a store's completed orders
export const generateStoreReport = (orders: Order[]): string => {
    const itemMap = new Map<string, { name: string, quantity: number, unit?: string }>();
    let storeName: StoreName | undefined;

    orders.forEach(order => {
        if (!storeName) storeName = order.store;
        order.items.forEach(item => {
            if (!item.isSpoiled) {
                const key = `${item.name}-${item.unit}`;
                if (itemMap.has(key)) {
                    itemMap.get(key)!.quantity += item.quantity;
                } else {
                    itemMap.set(key, { name: item.name, quantity: item.quantity, unit: item.unit });
                }
            }
        });
    });

    if (itemMap.size === 0) return `No items to report for ${storeName || 'the store'}.`;

    const sortedItems = Array.from(itemMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const itemsList = sortedItems.map(item => `   ${item.quantity}${item.unit || ''} ${item.name}`).join('\n');

    return `*${storeName} Delivery Report - ${new Date().toLocaleDateString('en-GB')}*\n\n${itemsList}`;
};

// Calculate total for an order
const calculateOrderTotal = (order: Order, itemPrices: ItemPrice[]): number => {
    return order.items.reduce((total, item) => {
        if (item.isSpoiled) return total;
        const latestPrice = getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price ?? 0;
        return total + ((item.price ?? latestPrice) * item.quantity);
    }, 0);
};

// Generate Kali Unify Report
export const generateKaliUnifyReport = (orders: Order[], itemPrices: ItemPrice[], previousDue: number = 0, topUp: number = 0): string => {
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let report = `KALI UNIFY ${today}\n\n`;

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
        report += `${storeName.padEnd(8, ' ')} ${formatPrice(storeTotal)}\n`;
    }

    const totalDue = previousDue + grandTotal - topUp;

    report += `---------------------\n`;
    report += `PREV DUE: ${formatPrice(previousDue)}\n`;
    report += `TODAY   : ${formatPrice(grandTotal)}\n`;
    report += `TOP UP  : ${formatPrice(topUp)}\n`;
    report += `TOTAL DUE: ${formatPrice(totalDue)}\n`;

    return report;
};

// Generate Kali Zap Report
export const generateKaliZapReport = (orders: Order[], itemPrices: ItemPrice[]): string => {
    let message = '<b>KALI ZAP REPORT</b>\n\n';
    let grandTotal = 0;

    for (const order of orders) {
        const orderTotal = calculateOrderTotal(order, itemPrices);
        grandTotal += orderTotal;
        message += `<b>${escapeHtml(order.store)}</b> - ${formatPrice(orderTotal)}\n`;
        order.items.forEach(item => {
            message += `  - ${escapeHtml(item.name)} x${item.quantity}${item.unit || ''}\n`;
        });
        message += '\n';
    }

    message += `---------------------\n<b>TOTAL: ${formatPrice(grandTotal)}</b>`;
    return message;
};

// Generate Due Report
export const generateDueReportMessage = (
    orders: Order[],
    itemPrices: ItemPrice[],
    sortBy: 'store' | 'supplier',
    previousDue: number = 0,
    topUp: number = 0
): string => {
    const today = new Date().toLocaleDateString('en-GB');
    let report = `<b>Daily Due Report ${today}</b>\n\n`;
    const groups: Record<string, { total: number, orders: Order[] }> = {};

    for (const order of orders) {
        const key = sortBy === 'store' ? order.store : order.supplierName;
        if (!groups[key]) groups[key] = { total: 0, orders: [] };
        groups[key].total += calculateOrderTotal(order, itemPrices);
        groups[key].orders.push(order);
    }
    
    let grandTotal = 0;
    for (const key of Object.keys(groups).sort()) {
        const group = groups[key];
        grandTotal += group.total;
        report += `<b>${escapeHtml(key)}</b>: ${formatPrice(group.total)}\n`;

        // If sorting by store, aggregate and list the items.
        if (sortBy === 'store') {
            const itemMap = new Map<string, { name: string; quantity: number; totalValue: number; unit?: Unit }>();

            for (const order of group.orders) {
                for (const item of order.items) {
                    if (item.isSpoiled) continue;

                    const itemKey = `${item.itemId}-${item.unit || 'none'}`;
                    const latestPriceInfo = getLatestItemPrice(item.itemId, order.supplierId, itemPrices);
                    const price = item.price ?? latestPriceInfo?.price ?? 0;
                    const itemTotal = price * item.quantity;

                    const existing = itemMap.get(itemKey);
                    if (existing) {
                        existing.quantity += item.quantity;
                        existing.totalValue += itemTotal;
                    } else {
                        itemMap.set(itemKey, {
                            name: item.name,
                            quantity: item.quantity,
                            totalValue: itemTotal,
                            unit: item.unit,
                        });
                    }
                }
            }

            const sortedItems = Array.from(itemMap.values()).sort((a, b) => a.name.localeCompare(b.name));

            for (const item of sortedItems) {
                const unitPrice = item.quantity > 0 ? item.totalValue / item.quantity : 0;
                // Format: (total) (name) (price) x(qty)
                report += `  - ${formatPrice(item.totalValue)} ${escapeHtml(item.name)} ${formatPrice(unitPrice)} x${item.quantity}${item.unit || ''}\n`;
            }
        }
    }
    
    const totalDue = previousDue + grandTotal - topUp;

    report += `\n---------------------\n`;
    report += `Previous Due: ${formatPrice(previousDue)}\n`;
    report += `Today's Total: ${formatPrice(grandTotal)}\n`;
    report += `Top Up: ${formatPrice(topUp)}\n`;
    report += `<b>TOTAL DUE: ${formatPrice(totalDue)}</b>`;

    return report;
};

// Generate Consolidated Receipt
export const generateConsolidatedReceipt = (
    orders: Order[],
    itemPrices: ItemPrice[],
    suppliers: Supplier[],
    format: 'plain' | 'html',
    options: { showPaymentMethods?: Set<string> } = {}
): string => {
    const { showPaymentMethods = new Set(Object.values(PaymentMethod)) } = options;

    const filteredOrders = orders.filter(order => {
        const supplier = suppliers.find(s => s.id === order.supplierId);
        const paymentMethod = order.paymentMethod || supplier?.paymentMethod;
        return paymentMethod && showPaymentMethods.has(paymentMethod);
    });

    if (format === 'html') {
        let html = `
        <style>
            body { font-family: monospace; font-size: 12px; margin: 0; padding: 5px; width: 300px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { text-align: left; padding: 2px 0; }
            .right { text-align: right; }
            .center { text-align: center; }
            .header { font-weight: bold; margin-bottom: 10px; }
            .total-line { border-top: 1px dashed #000; font-weight: bold; }
        </style>
        <div class="header center">BUY & DISPATCH</div>
        <div class="header center">${new Date().toLocaleDateString('en-GB')}</div>
        `;

        const totalsByPayment: Record<string, number> = {};
        let grandTotal = 0;

        for (const order of filteredOrders) {
            const orderTotal = calculateOrderTotal(order, itemPrices);
            grandTotal += orderTotal;
            const supplier = suppliers.find(s => s.id === order.supplierId);
            const paymentMethod = order.paymentMethod || supplier?.paymentMethod || 'UNKNOWN';
            totalsByPayment[paymentMethod] = (totalsByPayment[paymentMethod] || 0) + orderTotal;
        }

        html += `<table>`;
        for(const [method, total] of Object.entries(totalsByPayment)) {
            html += `<tr><td>${method.toUpperCase()}</td><td class="right">${formatPrice(total)}</td></tr>`;
        }
        html += `<tr class="total-line"><td>GRAND TOTAL</td><td class="right">${formatPrice(grandTotal)}</td></tr>`;
        html += `</table>`;
        return html;
    }

    // Plain text format
    let text = `BUY & DISPATCH - ${new Date().toLocaleDateString('en-GB')}\n\n`;
    const totalsByPayment: Record<string, number> = {};
    let grandTotal = 0;

    for (const order of filteredOrders) {
        const orderTotal = calculateOrderTotal(order, itemPrices);
        grandTotal += orderTotal;
        const supplier = suppliers.find(s => s.id === order.supplierId);
        const paymentMethod = order.paymentMethod || supplier?.paymentMethod || 'UNKNOWN';
        totalsByPayment[paymentMethod] = (totalsByPayment[paymentMethod] || 0) + orderTotal;
    }
    
    for(const [method, total] of Object.entries(totalsByPayment)) {
        text += `${method.toUpperCase().padEnd(10)} ${formatPrice(total).padStart(10)}\n`;
    }
    text += `----------------------\n`;
    text += `${'GRAND TOTAL'.padEnd(10)} ${formatPrice(grandTotal).padStart(10)}\n`;

    return text;
};