
import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { Order, Item, OrderStatus, Unit } from '../../types';
import { useNotifier } from '../../context/NotificationContext';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemSelect: (item: Item) => void;
  order?: Order | null;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onItemSelect, order }) => {
  const { state, actions } = useContext(AppContext);
  const { notify } = useNotifier();
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredItems = useMemo(() => {
    const itemsInOrder = new Set(order?.items.map(i => i.itemId) || []);
    const availableItems = state.items.filter(i => !itemsInOrder.has(i.id));

    const searchLower = search.toLowerCase();
    const searchFiltered = !search
      ? availableItems
      : availableItems.filter(item => 
          item.name.toLowerCase().includes(searchLower) || 
          item.supplierName.toLowerCase().includes(searchLower)
        );
        
    return searchFiltered.sort((a, b) => a.name.localeCompare(b.name));
  }, [search, state.items, order]);

  const handleItemClick = (item: Item) => {
    onItemSelect(item);
    setSearch('');
    onClose();
  };
  
  const handleAddNewItem = async () => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) return;

    if (!order) {
        notify("Please add a supplier card first to create new items.", "info");
        return; 
    }

    setIsCreating(true);
    try {
        const supplier = state.suppliers.find(s => s.id === order.supplierId);
        if (!supplier) {
            notify('Could not find the supplier for this order.', 'error');
            return;
        }

        const existingItemInDb = state.items.find(i => i.name.toLowerCase() === trimmedSearch.toLowerCase() && i.supplierId === supplier.id);
        
        let itemToAdd: Item;

        if (existingItemInDb) {
            itemToAdd = existingItemInDb;
        } else {
            notify(`Creating new master item: ${trimmedSearch}`, 'info');
            itemToAdd = await actions.addItem({
                name: trimmedSearch,
                supplierId: supplier.id,
                supplierName: supplier.name,
                unit: Unit.PC,
            });
        }
        
        onItemSelect(itemToAdd);
        setSearch('');
        onClose();
    } catch (e: any) {
        console.error("Failed to create and add new item:", e);
        notify(`Failed to create item: ${e.message}`, 'error');
    } finally {
        setIsCreating(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          if (filteredItems.length === 1) {
               handleItemClick(filteredItems[0]);
          } else {
               handleAddNewItem();
          }
      } else if (e.key === 'Escape') {
          onClose();
      }
  }

  if (!isOpen) return null;

  const indicatorColor = !order 
    ? 'bg-gray-500' 
    : order.status === OrderStatus.DISPATCHING ? 'bg-blue-500' :
      order.status === OrderStatus.ON_THE_WAY ? 'bg-yellow-500' :
      'bg-green-500';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
            <div className="flex items-center space-x-3 overflow-hidden">
                <div className={`w-2 h-8 rounded-full ${indicatorColor} flex-shrink-0`}></div>
                <h2 className="text-lg font-bold text-white truncate">
                    {order ? (
                        <>Add to <span className="text-gray-300 font-medium">{order.supplierName}</span></>
                    ) : (
                        "Select Item"
                    )}
                </h2>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 bg-gray-800 rounded-full hover:bg-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        
        <div className="p-4 space-y-4 flex-grow flex flex-col min-h-0">
            <div className="relative flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </div>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="w-full bg-gray-800 text-white rounded-xl py-3 pl-10 pr-4 outline-none border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-500"
                    placeholder={order ? "Search or create..." : "Search items..."}
                />
            </div>

            <div className="flex-grow overflow-y-auto space-y-1 pr-1 hide-scrollbar">
                {filteredItems.length === 0 ? (
                    search.trim() ? (
                        <div className="text-center py-8 px-4">
                            <p className="text-gray-400 mb-4 text-sm">No matching item found.</p>
                            {order ? (
                                <button
                                    onClick={handleAddNewItem}
                                    disabled={isCreating}
                                    className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center"
                                >
                                    {isCreating ? (
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <span>Create <span className="text-indigo-200">"{search.trim()}"</span></span>
                                    )}
                                </button>
                            ) : (
                                <p className="text-gray-600 italic text-xs">
                                    Select a supplier card to create new items.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="text-gray-600 text-center py-12 flex flex-col items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <p className="text-sm">Start typing to search</p>
                        </div>
                    )
                ) : (
                    filteredItems.map(item => (
                    <button 
                        key={item.id} 
                        onClick={() => handleItemClick(item)} 
                        className="w-full text-left p-3 rounded-xl hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-all group flex justify-between items-center"
                    >
                        <div className="flex flex-col min-w-0 mr-3">
                            <span className="text-gray-200 font-medium truncate group-hover:text-white">{item.name}</span>
                            <span className="text-gray-500 text-xs truncate">{item.supplierName}</span>
                        </div>
                        <span className="text-gray-600 text-xs font-mono bg-gray-800/50 px-2 py-1 rounded group-hover:bg-gray-900 group-hover:text-gray-400 transition-colors">
                            {item.unit}
                        </span>
                    </button>
                    ))
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AddItemModal;
