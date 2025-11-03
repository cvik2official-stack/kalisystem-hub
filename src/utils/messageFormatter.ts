import { Order, SupplierName, StoreName } from '../types';

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