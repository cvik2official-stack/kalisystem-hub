import React, { useState, useMemo, useContext, useEffect } from 'react';
import { Order } from '../../types';
import { AppContext } from '../../context/AppContext';
import { generateDueReportMessage } from '../../utils/messageFormatter';
import { sendDueReport } from '../../services/telegramService';
import { useNotifier } from '../../context/NotificationContext';

interface DueReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
}

const escapeHtml = (text: string): string => {
    if (typeof text !== 'string') return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const DueReportModal: React.FC<DueReportModalProps> = ({ isOpen, onClose, orders }) => {
    const { state } = useContext(AppContext);
    const { notify } = useNotifier();
    const [sortBy, setSortBy] = useState<'store' | 'supplier'>('store');
    const [isSending, setIsSending] = useState(false);
    const [previousDue, setPreviousDue] = useState('');
    const [topUp, setTopUp] = useState('');
    const [reportText, setReportText] = useState('');

    useEffect(() => {
        if (isOpen && orders.length > 0) {
            const due = parseFloat(previousDue) || 0;
            const topup = parseFloat(topUp) || 0;
            const message = generateDueReportMessage(orders, state.itemPrices, sortBy, due, topup);
            setReportText(message);
        } else if (!isOpen) {
            // Reset fields on close
            setPreviousDue('');
            setTopUp('');
        }
    }, [isOpen, orders, sortBy, previousDue, topUp, state.itemPrices]);

    const handleCopy = () => {
        navigator.clipboard.writeText(reportText);
        notify('Report copied to clipboard!', 'success');
    };

    const handleSend = async () => {
        const token = state.settings.telegramBotToken;
        if (!token) {
            notify('Telegram Bot Token is not configured.', 'error');
            return;
        }
        setIsSending(true);
        try {
            // Wrap the plain text in <pre> tags to preserve formatting in Telegram
            const htmlMessage = `<pre>${escapeHtml(reportText)}</pre>`;
            await sendDueReport(htmlMessage, token);
            notify('Due Report sent successfully!', 'success');
            onClose();
        } catch (error: any) {
            notify(`Failed to send report: ${error.message}`, 'error');
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
            <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg border-t-4 border-green-500" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} disabled={isSending} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h2 className="text-xl font-bold text-white mb-4">Daily Due Report</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label htmlFor="previous-due" className="block text-sm font-medium text-gray-300">Previous Due</label>
                        <input
                            type="text"
                            id="previous-due"
                            inputMode="decimal"
                            value={previousDue}
                            onChange={(e) => setPreviousDue(e.target.value)}
                            className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                     <div>
                        <label htmlFor="top-up" className="block text-sm font-medium text-gray-300">Top Up Amount</label>
                        <input
                            type="text"
                            id="top-up"
                            inputMode="decimal"
                            value={topUp}
                            onChange={(e) => setTopUp(e.target.value)}
                            className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-center space-x-2 bg-gray-900 p-1 rounded-full mb-4">
                    <button 
                        onClick={() => setSortBy('store')}
                        className={`px-4 py-1.5 text-sm font-semibold rounded-full w-full transition-colors ${sortBy === 'store' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                    >
                        By Store
                    </button>
                    <button 
                        onClick={() => setSortBy('supplier')}
                        className={`px-4 py-1.5 text-sm font-semibold rounded-full w-full transition-colors ${sortBy === 'supplier' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                    >
                        By Supplier
                    </button>
                </div>

                <textarea
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    className="w-full h-80 bg-gray-900 text-gray-300 rounded-md p-3 font-mono text-xs outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                />
                
                <div className="mt-6 flex justify-between items-center">
                    <button 
                        onClick={handleCopy} 
                        disabled={isSending}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-500 text-gray-200"
                    >
                        Copy
                    </button>
                    <button 
                        onClick={handleSend}
                        disabled={isSending}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-800 disabled:cursor-wait"
                    >
                        {isSending ? 'Sending...' : 'Send to Telegram'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DueReportModal;