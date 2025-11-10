import React, { useState, useMemo, useContext } from 'react';
import { Order } from '../../types';
import { AppContext } from '../../context/AppContext';
import { useNotifier } from '../../context/NotificationContext';
import { generateConsolidatedReceipt } from '../../utils/messageFormatter';
import { sendConsolidatedReceiptToStore } from '../../services/telegramService';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, orders }) => {
  const { state } = useContext(AppContext);
  const { notify } = useNotifier();
  const [activeTab, setActiveTab] = useState<'telegram' | 'ticket'>('telegram');
  const [isSending, setIsSending] = useState(false);

  const plainTextReceipt = useMemo(() => {
    if (!isOpen) return '';
    return generateConsolidatedReceipt(orders, state.itemPrices, 'plain');
  }, [isOpen, orders, state.itemPrices]);

  const htmlReceipt = useMemo(() => {
    if (!isOpen) return '';
    return generateConsolidatedReceipt(orders, state.itemPrices, 'html');
  }, [isOpen, orders, state.itemPrices]);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(plainTextReceipt).then(() => {
      notify('Receipt copied to clipboard!', 'success');
      onClose();
    });
  };

  const handleSendToTelegram = async () => {
    const { telegramBotToken } = state.settings;
    if (!telegramBotToken) {
      notify('Telegram Bot Token is not set.', 'error');
      return;
    }
    const store = state.stores.find(s => s.name === state.activeStore);
    if (!store || !store.chatId) {
      notify(`Chat ID for ${state.activeStore} is not set.`, 'error');
      return;
    }
    
    setIsSending(true);
    try {
        await sendConsolidatedReceiptToStore(store.chatId, plainTextReceipt, telegramBotToken);
        notify('Receipt sent to store chat!', 'success');
        onClose();
    } catch (e: any) {
        notify(`Failed to send receipt: ${e.message}`, 'error');
    } finally {
        setIsSending(false);
    }
  };

  const handlePrint = () => {
    const iframe = document.getElementById('receipt-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md border-t-4 border-indigo-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} disabled={isSending} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-4">Consolidated Receipt</h2>
        
        <div className="border-b border-gray-700">
          <nav className="-mb-px flex space-x-4">
            <button onClick={() => setActiveTab('telegram')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'telegram' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
              Telegram
            </button>
            <button onClick={() => setActiveTab('ticket')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'ticket' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
              Ticket
            </button>
          </nav>
        </div>
        
        <div className="mt-4">
          {activeTab === 'telegram' && (
            <div>
              <div className="bg-gray-900 rounded-md p-3 h-64 overflow-y-auto">
                <pre className="text-gray-300 whitespace-pre-wrap text-sm font-sans">{plainTextReceipt}</pre>
              </div>
              <div className="mt-6 flex justify-between items-center">
                <button onClick={handleCopyToClipboard} disabled={isSending} className="px-4 py-2 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-500 text-gray-200">
                  Copy
                </button>
                <button onClick={handleSendToTelegram} disabled={isSending} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">
                  {isSending ? 'Sending...' : 'Send to Telegram'}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'ticket' && (
            <div>
              <div className="bg-white rounded-md p-1 h-64 overflow-y-auto">
                <iframe id="receipt-iframe" srcDoc={htmlReceipt} title="Receipt Preview" className="w-full h-full border-0" />
              </div>
              <div className="mt-6 flex justify-end">
                <button onClick={handlePrint} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">
                  Print / Save as PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
