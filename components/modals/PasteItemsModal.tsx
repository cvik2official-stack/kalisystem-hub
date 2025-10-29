import React, { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import parseItemListWithGemini from '../../services/geminiService';
import { Order, OrderItem, OrderStatus, ParsedItem, SupplierName, StoreName, Supplier } from '../../types';
import { useToasts } from '../../context/ToastContext';
import { parseItemListLocally } from '../../services/localParsingService';

const PasteItemsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { state, dispatch } = useContext(AppContext);
  const { addToast } = useToasts();
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    if (isLoading) return;
    setIsLoading(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!text.trim() || state.activeStore === 'Settings') return;
    setIsLoading(true);
    try {
      const isAiEnabled = state.settings.isAiEnabled !== false;
      addToast(isAiEnabled ? 'Parsing with AI...' : 'Parsing locally...', 'info');
      
      const parsedItems = isAiEnabled
        ? await parseItemListWithGemini(text, state.items)
        : await parseItemListLocally(text, state.items);
      
      const ordersBySupplier: Record<string, { supplier: Supplier, items: OrderItem[] }> = {};

      for (const pItem of parsedItems) {
        let supplier: Supplier | null = null;
        let orderItem: OrderItem | null = null;

        if (pItem.matchedItemId) {
          const existingItem = state.items.find(i => i.id === pItem.matchedItemId);
          if (existingItem) {
            supplier = state.suppliers.find(s => s.id === existingItem.supplierId) || null;
            orderItem = {
              itemId: existingItem.id,
              name: existingItem.name,
              quantity: pItem.quantity,
              unit: pItem.unit ?? existingItem.unit,
            };
          }
        } else if (pItem.newItemName) {
           supplier = state.suppliers.find(s => s.name === 'MARKET') || null;
           if (supplier) {
               orderItem = {
                   itemId: `new_${Date.now()}_${Math.random()}`,
                   name: pItem.newItemName,
                   quantity: pItem.quantity,
                   unit: pItem.unit ?? undefined
               };
           }
        }

        if (supplier && orderItem) {
            if (!ordersBySupplier[supplier.name]) {
                ordersBySupplier[supplier.name] = { supplier, items: [] };
            }
            ordersBySupplier[supplier.name].items.push(orderItem);
        }
      }
      
      const newOrders: Order[] = Object.values(ordersBySupplier).map(({supplier, items}) => {
          const d = new Date();
          const dateStr = `${d.getDate().toString().padStart(2, '0')}${ (d.getMonth() + 1).toString().padStart(2, '0')}`;
          const store = state.activeStore as StoreName;
          const counterKey = `${dateStr}_${supplier.name}_${store}`;
          const newCounter = (state.orderIdCounters[counterKey] || 0) + 1;
          const newOrderId = `${dateStr}_${supplier.name}_${store}_${String(newCounter).padStart(3,'0')}`;
          const existingOrderForSupplier = state.orders.find(o => o.store === store && o.supplierId === supplier.id && o.status === OrderStatus.DISPATCHING);
          
          if (existingOrderForSupplier) {
              items.forEach(item => {
                  dispatch({ type: 'ADD_ITEM_TO_ORDER', payload: { orderId: existingOrderForSupplier.id, item } });
              });
              return null;
          }

          return {
              id: `o_${Date.now()}_${supplier.name}`,
              orderId: newOrderId,
              store: store,
              supplierId: supplier.id,
              supplierName: supplier.name,
              items,
              status: OrderStatus.DISPATCHING,
              isSent: false,
              isReceived: false,
              createdAt: d.toISOString(),
              modifiedAt: d.toISOString(),
          }
      }).filter(Boolean) as Order[];
      
      const createdCount = newOrders.length;
      const updatedCount = Object.keys(ordersBySupplier).length - createdCount;

      if(createdCount > 0) {
        dispatch({type: 'ADD_ORDERS', payload: newOrders});
        addToast(`${createdCount} new order(s) created.`, 'success');
      } 
      if (updatedCount > 0) {
        addToast(`${updatedCount} existing order(s) updated.`, 'info');
      }
      if (createdCount === 0 && updatedCount === 0) {
        addToast('Could not parse any items from the list.', 'info');
      }

      onClose();
      setText('');

    } catch (e: any) {
      addToast(e.message || "An unknown error occurred.", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 border-t-4 border-blue-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-4">Paste Item List</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your item list here, e.g., '2kg tomato, 5 packs of cheese'"
          className="w-full h-48 bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
        />
        <div className="mt-6 flex justify-end min-h-[2.5rem]">
          {!isLoading ? (
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              Create / Update Orders
            </button>
          ) : (
            <div className="w-full flex flex-col items-center justify-center space-y-1">
                <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-xs font-semibold text-indigo-300">
                    Processing items...
                </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasteItemsModal;