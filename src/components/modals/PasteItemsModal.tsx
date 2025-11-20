
import React, { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import parseItemListWithGemini from '../../services/geminiService';
import { OrderItem, OrderStatus, SupplierName, StoreName, Supplier, Unit, Item } from '../../types';
import { useNotifier } from '../../context/NotificationContext';
import { parseItemListLocally } from '../../services/localParsingService';
import AiRulesModal from './AiRulesModal';

// Client-side safety net to ensure units are always valid for the database enum.
const normalizeUnit = (unit?: string): Unit | undefined => {
    if (!unit) return undefined;
    const u = unit.toLowerCase().trim();
    switch (u) {
        case 'pcs':
        case 'piece':
        case 'pieces':
            return Unit.PC;
        case 'kgs':
        case 'kilo':
        case 'kilos':
        case 'kilogram':
            return Unit.KG;
        case 'litter':
        case 'liters':
        case 'litres':
            return Unit.L;
        case 'rolls':
            return Unit.ROLL;
        case 'blocks':
            return Unit.BLOCK;
        case 'boxes':
        case 'bx':
            return Unit.BOX;
        case 'pax':
        case 'packs':
            return Unit.PK;
        case 'btl':
        case 'btls':
        case 'bottle':
        case 'bottles':
            return Unit.BT;
        case 'cans':
            return Unit.CAN;
        case 'glasses':
            return Unit.GLASS;
        default:
            // Check if it's already a valid unit
            if (Object.values(Unit).includes(u as Unit)) {
                return u as Unit;
            }
            // If we can't map it, return undefined so the default can be used.
            return undefined;
    }
};

const PasteItemsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { notify } = useNotifier();
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAiRulesModalOpen, setIsAiRulesModalOpen] = useState(false);

  const handleClose = () => {
    if (isLoading) return;
    setText('');
    setIsLoading(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;

    // FIX: Refactored guard clauses for type safety. This prevents pasting into special views.
    if (state.activeStore === 'Settings' || state.activeStore === 'ALL' || state.activeStore === 'TODO') {
        notify(`Pasting items is not available for the "${state.activeStore}" view.`, 'info');
        return;
    }
    
    // After the guard, TypeScript knows activeStore is a valid StoreName.
    const store = state.activeStore;

    setIsLoading(true);
    try {
      const isAiEnabled = state.settings.isAiEnabled !== false;
      notify(isAiEnabled ? 'Parsing with AI...' : 'Parsing locally...', 'info');
      
      let parsedItems;
      if (isAiEnabled) {
          const geminiApiKey = state.settings.geminiApiKey;
          if (!geminiApiKey) {
              notify('Gemini API key not set. Please add it in Settings > Integrations.', 'error');
              setIsLoading(false);
              return;
          }

          const rules = state.settings.aiParsingRules || {};
          const activeStoreRules = rules[store] || {};
          const combinedAliases = {
              ...(rules.global || {}),
              ...activeStoreRules,
          };
          const rulesForApi = { aliases: combinedAliases };

          parsedItems = await parseItemListWithGemini(text, state.items, geminiApiKey, rulesForApi);
      } else {
          parsedItems = await parseItemListLocally(text, state.items);
      }
      
      const ordersBySupplier: Record<string, { supplier: Supplier, items: OrderItem[] }> = {};

      for (const pItem of parsedItems) {
        let supplier: Supplier | null = null;
        let orderItem: OrderItem | null = null;

        if (pItem.matchedItemId) {
          const existingItem = state.items.find(i => i.id === pItem.matchedItemId);
          if (existingItem) {
            supplier = state.suppliers.find(s => s.id === existingItem.supplierId) || null;
            // For matched items, ALWAYS use the unit from the database, ignoring any parsed unit.
            orderItem = { itemId: existingItem.id, name: existingItem.name, quantity: pItem.quantity, unit: existingItem.unit };
          }
        } else if (pItem.newItemName) {
           supplier = state.suppliers.find(s => s.name === 'MARKET') || null;
           if (supplier) {
               const existingItemInDb = state.items.find(i => i.name.toLowerCase() === pItem.newItemName!.toLowerCase() && i.supplierId === supplier!.id);
               let finalItem: Item;
               if (existingItemInDb) {
                   finalItem = existingItemInDb;
               } else {
                   notify(`Creating new item: ${pItem.newItemName}`, 'info');
                   finalItem = await actions.addItem({
                       name: pItem.newItemName, supplierId: supplier.id,
                       supplierName: supplier.name, 
                       // Apply client-side normalization as a safety net
                       unit: normalizeUnit(pItem.unit) ?? Unit.PC
                   });
               }
               orderItem = { itemId: finalItem.id, name: finalItem.name, quantity: pItem.quantity, unit: finalItem.unit };
           }
        }

        if (supplier && orderItem) {
            if (!ordersBySupplier[supplier.id]) {
                ordersBySupplier[supplier.id] = { supplier, items: [] };
            }
            ordersBySupplier[supplier.id].items.push(orderItem);
        }
      }
      
      let createdCount = 0;
      let updatedCount = 0;

      for (const { supplier, items } of Object.values(ordersBySupplier)) {
          const existingOrderForSupplier = state.orders.find(o => o.store === store && o.supplierId === supplier.id && o.status === OrderStatus.DISPATCHING);
          
          if (existingOrderForSupplier) {
              const updatedItems = [...existingOrderForSupplier.items];
              items.forEach(itemToAdd => {
                  const existingItemIndex = updatedItems.findIndex(i => i.itemId === itemToAdd.itemId);
                  if (existingItemIndex !== -1) {
                      updatedItems[existingItemIndex].quantity += itemToAdd.quantity;
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

      if(createdCount > 0) notify(`${createdCount} new order(s) created.`, 'success');
      if (updatedCount > 0) notify(`${updatedCount} existing order(s) updated.`, 'info');
      if (createdCount === 0 && updatedCount === 0) notify('Could not parse any items.', 'info');

      handleClose();
    } catch (e: any) {
      notify(e.message || "An unknown error occurred.", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={handleClose}>
        <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg border-t-4 border-blue-500" onClick={(e) => e.stopPropagation()}>
          <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Paste Item List</h2>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-48 bg-gray-900 text-gray-200 rounded-md p-3 outline-none text-sm"
          />
          <div className="mt-6 flex justify-between items-center min-h-[2.5rem]">
            {!isLoading ? (
              <>
                {state.settings.isAiEnabled ? (
                    <button onClick={() => setIsAiRulesModalOpen(true)} className="text-gray-400 hover:text-white" title="Edit AI Parsing Rules">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </button>
                ) : <div />}
                <button
                  onClick={handleSubmit}
                  disabled={!text.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-600"
                >
                  Dispatch
                </button>
              </>
            ) : (
              <div className="w-full flex flex-col items-center justify-center space-y-1">
                  <svg className="animate-spin h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span className="text-xs font-semibold text-indigo-300">Processing items...</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <AiRulesModal isOpen={isAiRulesModalOpen} onClose={() => setIsAiRulesModalOpen(false)} />
    </>
  );
};

export default PasteItemsModal;
