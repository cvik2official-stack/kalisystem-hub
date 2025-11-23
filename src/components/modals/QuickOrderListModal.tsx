
import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { useNotifier } from '../../context/NotificationContext';
import { OrderStatus, QuickOrder } from '../../types';
import { generateOrderMessage } from '../../utils/messageFormatter';
import { sendOrderToSupplierOnTelegram, sendOrderToStoreOnTelegram } from '../../services/telegramService';

interface QuickOrderListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuickOrderListModal: React.FC<QuickOrderListModalProps> = ({ isOpen, onClose }) => {
  const { state, actions } = useContext(AppContext);
  const { quickOrders, suppliers, stores, settings } = state;
  const { notify } = useNotifier();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (confirm('Delete this quick order?')) {
          actions.deleteQuickOrder(id);
      }
  };

  const handleTriggerOrder = async (quickOrder: QuickOrder) => {
      setIsProcessing(quickOrder.id);
      try {
          const supplier = suppliers.find(s => s.id === quickOrder.supplierId);
          if (!supplier) throw new Error('Supplier not found');
          const newOrder = await actions.addOrder(supplier, quickOrder.store, quickOrder.items, OrderStatus.DISPATCHING);
          if (settings.telegramBotToken) {
             if (supplier.chatId) await sendOrderToSupplierOnTelegram(newOrder, supplier, generateOrderMessage(newOrder, 'html', suppliers, stores, settings), settings.telegramBotToken);
             const store = stores.find(s => s.name === quickOrder.store);
             if (store?.chatId) await sendOrderToStoreOnTelegram(newOrder, store.chatId, settings.telegramBotToken);
          }
          await actions.updateOrder({ ...newOrder, status: OrderStatus.ON_THE_WAY, isSent: true });
          notify(`Quick Order "${quickOrder.name}" processed!`, 'success');
          onClose();
      } catch (e: any) {
          notify(`Failed: ${e.message}`, 'error');
      } finally {
          setIsProcessing(null);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        
        <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
             <div className="flex items-center space-x-3">
                <div className="w-2 h-8 rounded-full bg-blue-500 flex-shrink-0"></div>
                <h2 className="text-lg font-bold text-white">Quick Orders</h2>
            </div>
             <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 bg-gray-800 rounded-full hover:bg-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        
        <div className="flex-grow overflow-y-auto space-y-2 p-4 hide-scrollbar">
            {quickOrders.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <p className="text-gray-500">No saved quick orders.</p>
                </div>
            ) : (
                quickOrders.map(qo => (
                    <div key={qo.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex justify-between items-center group hover:border-gray-600 transition-colors">
                        <div onClick={() => handleTriggerOrder(qo)} className="flex-grow cursor-pointer">
                            <h3 className="font-bold text-white text-sm mb-1 group-hover:text-blue-400 transition-colors">{qo.name}</h3>
                            <div className="flex items-center text-xs text-gray-400 space-x-2">
                                <span className="bg-gray-900 px-1.5 py-0.5 rounded">{qo.store}</span>
                                <span>&bull;</span>
                                <span>{qo.supplierName}</span>
                                <span>&bull;</span>
                                <span>{qo.items.length} items</span>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                             {isProcessing === qo.id && <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                             <button onClick={(e) => handleDelete(e, qo.id)} className="p-2 text-gray-600 hover:text-red-500 hover:bg-gray-700/50 rounded-lg transition-colors"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};

export default QuickOrderListModal;
