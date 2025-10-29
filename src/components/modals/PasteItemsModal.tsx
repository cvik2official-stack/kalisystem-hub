import React, { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import parseItemListWithGemini from '../../services/geminiService';
import { Order, OrderItem, OrderStatus, ParsedItem, SupplierName, StoreName, Supplier } from '../../types';
import { useToasts } from '../../context/ToastContext';
import { parseItemListLocally } from '../../services/localParsingService';
import { addOrder as supabaseAddOrder } from '../../services/supabaseService';


const PasteItemsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { state, dispatch, actions } = useContext(AppContext);
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
      
      let createdCount = 0;
      let updatedCount = 0;

      for (const { supplier, items } of Object.values(ordersBySupplier)) {
          const store = state.activeStore as StoreName;
          const existingOrderForSupplier = state.orders.find(o => o.store === store && o.supplierId === supplier.id && o.status === OrderStatus.DISPATCHING);
          
          if (existingOrderForSupplier) {
              const updatedItems = [...existingOrderForSupplier.items];
              items.forEach(itemToAdd => {
                  const existingItemIndex = updatedItems.findIndex(i => i.itemId === itemToAdd.itemId);
                  if (existingItemIndex !== -1) {
                      const existingItem = updatedItems[existingItemIndex];
                      updatedItems[existingItemIndex] = { ...existingItem, quantity: existingItem.quantity + itemToAdd.quantity };
                  } else {
                      updatedItems.push(itemToAdd);
                  }
              });
              await actions.updateOrder({ ...existingOrderForSupplier, items: updatedItems });
              updatedCount++;
          } else {
              await actions.addOrder(supplier, store, items);
              createdCount++;
          }
      }

      if(createdCount > 0) {
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
          className="w-full h-48 bg-gray-900 text-gray-200 rounded-md p-3 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500 text-sm"
        />
        <div className="mt-6 flex justify-end min-h-[2.5rem]">
          {!isLoading ? (
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              Dispatch
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