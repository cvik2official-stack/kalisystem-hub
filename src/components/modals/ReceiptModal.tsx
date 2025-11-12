import React, { useState, useMemo, useContext, useEffect } from 'react';
import { Order, PaymentMethod } from '../../types';
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

  // State for new filters
  const [suppliersToShow, setSuppliersToShow] = useState<Set<string>>(new Set());
  const [paymentMethodsToShow, setPaymentMethodsToShow] = useState<Set<string>>(new Set());

  // Derive filter options from the orders passed to the modal
  const uniqueSuppliers = useMemo(() => {
    if (!isOpen) return [];
    return Array.from(new Set(orders.map(o => o.supplierName))).sort();
  }, [isOpen, orders]);
  
  const uniquePaymentMethods = useMemo(() => {
    if (!isOpen) return [];
    const methods = new Set<string>();
    orders.forEach(order => {
      const supplier = state.suppliers.find(s => s.id === order.supplierId);
      const paymentMethod = order.paymentMethod || supplier?.paymentMethod;
      if (paymentMethod) {
        methods.add(paymentMethod);
      }
    });
    return Array.from(methods).sort();
  }, [isOpen, orders, state.suppliers]);

  // Initialize filters when modal opens or orders change
  useEffect(() => {
    if (isOpen) {
      setSuppliersToShow(new Set(uniqueSuppliers));
      setPaymentMethodsToShow(new Set(uniquePaymentMethods));
    }
  }, [isOpen, uniqueSuppliers, uniquePaymentMethods]);

  const handleSupplierToggle = (supplierName: string) => {
    setSuppliersToShow(prev => {
      const newSet = new Set(prev);
      if (newSet.has(supplierName)) newSet.delete(supplierName);
      else newSet.add(supplierName);
      return newSet;
    });
  };

  const handlePaymentMethodToggle = (paymentMethod: string) => {
    setPaymentMethodsToShow(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paymentMethod)) newSet.delete(paymentMethod);
      else newSet.add(paymentMethod);
      return newSet;
    });
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => suppliersToShow.has(o.supplierName));
  }, [orders, suppliersToShow]);

  const plainTextReceipt = useMemo(() => {
    if (!isOpen) return '';
    // FIX: Pass suppliers to generateConsolidatedReceipt.
    return generateConsolidatedReceipt(filteredOrders, state.itemPrices, state.suppliers, 'plain', { showPaymentMethods: paymentMethodsToShow });
  }, [isOpen, filteredOrders, state.itemPrices, state.suppliers, paymentMethodsToShow]);

  const htmlReceipt = useMemo(() => {
    if (!isOpen) return '';
    // FIX: Pass suppliers to generateConsolidatedReceipt.
    return generateConsolidatedReceipt(filteredOrders, state.itemPrices, state.suppliers, 'html', { showPaymentMethods: paymentMethodsToShow });
  }, [isOpen, filteredOrders, state.itemPrices, state.suppliers, paymentMethodsToShow]);


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
      // Add a small delay to ensure the srcDoc content is fully rendered before printing
      setTimeout(() => {
        iframe.contentWindow?.print();
      }, 100);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md border-t-4 border-indigo-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} disabled={isSending} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-4">Buy & Dispatch.</h2>
        
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
          <div className="bg-gray-900 rounded-lg p-3 mb-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Filters</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Suppliers</h4>
                      <div className="flex flex-col space-y-1">
                          {uniqueSuppliers.map(name => (
                              <label key={name} className="flex items-center text-sm text-gray-300">
                                  <input type="checkbox" checked={suppliersToShow.has(name)} onChange={() => handleSupplierToggle(name)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                  <span className="ml-2">{name}</span>
                              </label>
                          ))}
                      </div>
                  </div>
                   <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Payments</h4>
                      <div className="flex flex-col space-y-1">
                          {uniquePaymentMethods.map(method => (
                              <label key={method} className="flex items-center text-sm text-gray-300">
                                  <input type="checkbox" checked={paymentMethodsToShow.has(method)} onChange={() => handlePaymentMethodToggle(method)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
                                  <span className="ml-2">{method.toUpperCase()}</span>
                              </label>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
          {activeTab === 'telegram' && (
            <div>
              <div className="bg-gray-900 rounded-md p-3 h-64 overflow-y-auto">
                <pre className="text-gray-300 whitespace-pre-wrap text-sm font-mono">{plainTextReceipt}</pre>
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