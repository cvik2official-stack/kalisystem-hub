
import React, { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import parseItemListWithGemini from '../../services/geminiService';
import { OrderItem, OrderStatus, SupplierName, StoreName, Supplier, Unit, Item } from '../../types';
import { useNotifier } from '../../context/NotificationContext';
import { parseItemListLocally } from '../../services/localParsingService';
import AiRulesModal from './AiRulesModal';

const normalizeUnit = (unit?: string): Unit | undefined => {
    if (!unit) return undefined;
    const u = unit.toLowerCase().trim();
    switch (u) {
        case 'pcs': case 'piece': case 'pieces': return Unit.PC;
        case 'kgs': case 'kilo': case 'kilos': case 'kilogram': return Unit.KG;
        case 'litter': case 'liters': case 'litres': return Unit.L;
        case 'rolls': return Unit.ROLL; case 'blocks': return Unit.BLOCK; case 'boxes': case 'bx': return Unit.BOX;
        case 'pax': case 'packs': return Unit.PK; case 'btl': case 'btls': case 'bottle': case 'bottles': return Unit.BT;
        case 'cans': return Unit.CAN; case 'glasses': return Unit.GLASS;
        default: if (Object.values(Unit).includes(u as Unit)) return u as Unit; return undefined;
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
    if (state.activeStore === 'Settings' || state.activeStore === 'ALL') {
        notify(`Pasting items is not available for the "${state.activeStore}" view.`, 'info');
        return;
    }
    
    const store = state.activeStore;
    setIsLoading(true);
    try {
      const isAiEnabled = state.settings.isAiEnabled !== false;
      notify(isAiEnabled ? 'Parsing with AI...' : 'Parsing locally...', 'info');
      
      let parsedItems;
      if (isAiEnabled) {
          const geminiApiKey = state.settings.geminiApiKey;
          if (!geminiApiKey) {
              notify('Gemini API key not set.', 'error');
              setIsLoading(false); return;
          }
          const rules = state.settings.aiParsingRules || {};
          const activeStoreRules = rules[store] || {};
          const combinedAliases = { ...(rules.global || {}), ...activeStoreRules };
          parsedItems = await parseItemListWithGemini(text, state.items, geminiApiKey, { aliases: combinedAliases });
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
            orderItem = { itemId: existingItem.id, name: existingItem.name, quantity: pItem.quantity, unit: existingItem.unit };
          }
        } else if (pItem.newItemName) {
           supplier = state.suppliers.find(s => s.name === 'MARKET') || null;
           if (supplier) {
               const existingItemInDb = state.items.find(i => i.name.toLowerCase() === pItem.newItemName!.toLowerCase() && i.supplierId === supplier!.id);
               let finalItem: Item;
               if (existingItemInDb) { finalItem = existingItemInDb; } else {
                   notify(`Creating new item: ${pItem.newItemName}`, 'info');
                   finalItem = await actions.addItem({ name: pItem.newItemName, supplierId: supplier.id, supplierName: supplier.name, unit: normalizeUnit(pItem.unit) ?? Unit.PC });
               }
               orderItem = { itemId: finalItem.id, name: finalItem.name, quantity: pItem.quantity, unit: finalItem.unit };
           }
        }

        if (supplier && orderItem) {
            if (!ordersBySupplier[supplier.id]) ordersBySupplier[supplier.id] = { supplier, items: [] };
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
                  if (existingItemIndex !== -1) updatedItems[existingItemIndex].quantity += itemToAdd.quantity;
                  else updatedItems.push(itemToAdd);
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
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={handleClose}>
        <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
            <h2 className="text-lg font-bold text-white">Paste List</h2>
            <button onClick={handleClose} className="text-gray-500 hover:text-white p-1 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div className="p-5 flex flex-col space-y-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-64 bg-gray-800 text-gray-200 rounded-xl p-4 outline-none border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm placeholder-gray-500 resize-none font-mono leading-relaxed"
                placeholder="Paste your list here..."
                autoFocus
              />
              
              <div className="flex justify-between items-center pt-2">
                {state.settings.isAiEnabled ? (
                    <button 
                        onClick={() => setIsAiRulesModalOpen(true)} 
                        className="text-gray-400 hover:text-indigo-400 transition-colors flex items-center text-sm font-medium"
                        title="AI Parsing Rules"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      AI Rules
                    </button>
                ) : <div></div>}
                
                {!isLoading ? (
                    <button
                      onClick={handleSubmit}
                      disabled={!text.trim()}
                      className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:bg-gray-800 disabled:text-gray-600 transition-all shadow-lg shadow-indigo-900/20 disabled:shadow-none"
                    >
                      Parse & Dispatch
                    </button>
                ) : (
                    <div className="flex items-center px-4 py-2 bg-gray-800 rounded-xl border border-gray-700">
                        <svg className="animate-spin h-5 w-5 text-indigo-400 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span className="text-sm font-medium text-gray-300">Thinking...</span>
                    </div>
                )}
              </div>
          </div>
        </div>
      </div>
      <AiRulesModal isOpen={isAiRulesModalOpen} onClose={() => setIsAiRulesModalOpen(false)} />
    </>
  );
};

export default PasteItemsModal;
