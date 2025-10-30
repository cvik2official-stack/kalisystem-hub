// src/utils/messageFormatter.ts
import { Order, SupplierName } from '../types';

const escapeHtml = (text: string): string => {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

export const generateOrderMessage = (order: Order, format: 'plain' | 'html'): string => {
    const isHtml = format === 'html';

    if (order.supplierName === SupplierName.KALI) {
        return (isHtml ? `<b>${escapeHtml(order.store)}</b>` : order.store) + '\n' +
            order.items.map(item => {
                const unitText = item.unit ? (isHtml ? escapeHtml(item.unit) : item.unit) : '';
                const itemName = isHtml ? escapeHtml(item.name) : item.name;
                return `${itemName} x${item.quantity}${unitText}`;
            }).join('\n');
    }

    const header = isHtml
        ? `<b>#️⃣ Order ${escapeHtml(order.orderId)}</b>\n🚚 Delivery order\n📌 <b>${escapeHtml(order.store)}</b>\n\n`
        : `#️⃣ Order ${order.orderId}\n🚚 Delivery order\n📌 ${order.store}\n\n`;

    return header + order.items.map(item => {
        const unitText = item.unit ? ` ${isHtml ? escapeHtml(item.unit) : item.unit}` : '';
        const itemName = isHtml ? `<i>${escapeHtml(item.name)}</i>` : item.name;
        return `${itemName} x${item.quantity}${unitText}`;
    }).join('\n');
};
