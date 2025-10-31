import { Order, SupplierName } from '../types';

const escapeHtml = (text: string): string => {
  if (typeof text !== 'string') return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

export const generateOrderMessage = (order: Order, format: 'plain' | 'html'): string => {
    const isHtml = format === 'html';

    // KALI supplier has a special, simplified format
    if (order.supplierName === SupplierName.KALI) {
        const header = isHtml ? `<b>${escapeHtml(order.store)}</b>` : order.store;
        const itemsList = order.items.map(item => {
            const unitText = item.unit ? (isHtml ? escapeHtml(item.unit) : item.unit) : '';
            const itemName = isHtml ? escapeHtml(item.name) : item.name;
            return `${itemName} x${item.quantity}${unitText}`;
        }).join('\n');
        return `${header}\n${itemsList}`;
    }

    // Default message format for all other suppliers
    const header = isHtml
        ? `<b>#️⃣ Order ${escapeHtml(order.orderId)}</b>\n🚚 Delivery order\n📌 <b>${escapeHtml(order.store)}</b>\n\n`
        : `#️⃣ Order ${order.orderId}\n🚚 Delivery order\n📌 ${order.store}\n\n`;
    
    const itemsList = order.items.map(item => {
        const unitText = item.unit ? ` ${isHtml ? escapeHtml(item.unit) : item.unit}` : '';
        const itemName = isHtml ? `<i>${escapeHtml(item.name)}</i>` : item.name;
        return `${itemName} x${item.quantity}${unitText}`;
    }).join('\n');

    return `${header}${itemsList}`;
};
