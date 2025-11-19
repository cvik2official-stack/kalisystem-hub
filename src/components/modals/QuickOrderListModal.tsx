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
          // 1. Create Order
          const supplier = suppliers.find(s => s.id === quickOrder.supplierId);
          if (!supplier) throw new Error('Supplier not found');
          
          const newOrder = await actions.addOrder(supplier, quickOrder.store, quickOrder.items, OrderStatus.DISPATCHING);
          
          // 2. Send Telegrams
          if (settings.telegramBotToken) {
             if (supplier.chatId) {
                 await sendOrderToSupplierOnTelegram(newOrder, supplier, generateOrderMessage(newOrder, 'html', suppliers, stores, settings), settings.telegramBotToken);
             }
             
             const store = stores.find(s => s.name === quickOrder.store);
             if (store?.chatId) {
                 await sendOrderToStoreOnTelegram(newOrder, store.chatId, settings.telegramBotToken);
             }
          }

          // 3. Update Status
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg h-[80vh] flex flex-col border-t-4 border-blue-500" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-bold text-white">Quick Orders</h2>
             <button onClick={onClose} className="text-gray-400 hover:text-white"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        
        <div className="flex-grow overflow-y-auto space-y-2 pr-2 -mr-2 hide-scrollbar">
            {quickOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-10">No saved quick orders.</p>
            ) : (
                quickOrders.map(qo => (
                    <div key={qo.id} className="bg-gray-900 p-3 rounded-lg flex justify-between items-center group">
                        <div onClick={() => handleTriggerOrder(qo)} className="flex-grow cursor-pointer">
                            <h3 className="font-bold text-white text-sm">{qo.name}</h3>
                            <p className="text-xs text-gray-400">{qo.supplierName} &bull; {qo.store} &bull; {qo.items.length} items</p>
                        </div>
                        <div className="flex items-center space-x-2">
                             {isProcessing === qo.id && <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                             <button onClick={(e) => handleDelete(e, qo.id)} className="p-2 text-gray-600 hover:text-red-500 transition-colors"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
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