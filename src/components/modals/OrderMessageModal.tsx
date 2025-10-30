import React, { useState, useMemo, useContext } from 'react';
import { Order, OrderStatus, SupplierName } from '../../types';
import { useToasts } from '../../context/ToastContext';
import { AppContext } from '../../context/AppContext';
import { sendTelegramMessage } from '../../services/telegramService';

interface OrderMessageModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

const escapeHtml = (text: string): string => {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const OrderMessageModal: React.FC<OrderMessageModalProps> = ({ order, isOpen, onClose }) => {
    const { state } = useContext(AppContext);
    const { addToast } = useToasts();
    const [isSending, setIsSending] = useState(false);
    
    const { plainTextMessage, htmlMessage } = useMemo(() => {
        if (order.supplierName === SupplierName.KALI) {
            const plain = `${order.store}\n` +
                order.items.map(item => {
                    const unitText = item.unit ? `${item.unit}` : ''; // No space for KALI
                    return `${item.name} x${item.quantity}${unitText}`;
                }).join('\n');

            const html = `<b>${escapeHtml(order.store)}</b>\n` +
                order.items.map(item => {
                    const unitText = item.unit ? `${escapeHtml(item.unit)}` : ''; // No space
                    return `${escapeHtml(item.name)} x${item.quantity}${unitText}`;
                }).join('\n');

            return { plainTextMessage: plain, htmlMessage: html };
        }

        // Default
        const plainItems = order.items.map(item => {
            const unitText = item.unit ? ` ${item.unit}` : ''; // Space for others
            return `${item.name} x${item.quantity}${unitText}`;
        }).join('\n');
        const plain = `#️⃣ Order ${order.orderId}\n🚚 Delivery order\n📌 ${order.store}\n\n${plainItems}`;

        const htmlItems = order.items.map(item => {
            const unitText = item.unit ? ` ${escapeHtml(item.unit)}` : ''; // Space
            return `<i>${escapeHtml(item.name)}</i> x${item.quantity}${unitText}`;
        }).join('\n');
        const html = `<b>#️⃣ Order ${escapeHtml(order.orderId)}</b>\n🚚 Delivery order\n📌 <b>${escapeHtml(order.store)}</b>\n\n${htmlItems}`;
        
        return { plainTextMessage: plain, htmlMessage: html };
    }, [order]);

    const handleSendWithTelegram = async () => {
        const supplier = state.suppliers.find(s => s.name === order.supplierName);
        if (!state.settings.telegramToken || !supplier?.telegramGroupId) {
            addToast('Telegram is not configured for this supplier.', 'error');
            return;
        }

        setIsSending(true);
        try {
            const success = await sendTelegramMessage({
                botToken: state.settings.telegramToken,
                chatId: supplier.telegramGroupId,
                text: htmlMessage,
                parseMode: 'HTML'
            });

            if (success) {
                addToast('Order sent to Telegram!', 'success');
                onClose();
            } else {
                 addToast('Failed to send order to Telegram.', 'error');
            }
        } catch (error) {
            addToast('Failed to send order to Telegram.', 'error');
        } finally {
            setIsSending(false);
        }
    };
    
    const handleCopyToClipboard = () => {
        navigator.clipboard.writeText(plainTextMessage).then(() => {
            addToast('Order copied to clipboard!', 'success');
            onClose();
        });
    }

    if (!isOpen) return null;

    const canSendTelegram = !!state.settings.telegramToken && !!state.suppliers.find(s => s.name === order.supplierName)?.telegramGroupId;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
            <div className={`relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 border-t-4 ${
                order.status === OrderStatus.DISPATCHING ? 'border-blue-500' :
                order.status === OrderStatus.ON_THE_WAY ? 'border-yellow-500' :
                'border-green-500'
            }`} onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h2 className="text-xl font-bold text-white mb-4">Order Message for {order.supplierName}</h2>
                <div className="bg-gray-900 rounded-md p-4 max-h-60 overflow-y-auto">
                    <pre className="text-gray-300 whitespace-pre-wrap text-sm font-sans">{plainTextMessage}</pre>
                </div>
                <div className="mt-6 flex justify-between items-center">
                    <button onClick={handleCopyToClipboard} className="px-4 py-2 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-500 text-gray-200">
                        Copy Text
                    </button>
                    {canSendTelegram && (
                        <button onClick={handleSendWithTelegram} disabled={isSending} className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-800 disabled:cursor-not-allowed">
                            {isSending ? 'Sending...' : 'Send to Telegram'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrderMessageModal;
