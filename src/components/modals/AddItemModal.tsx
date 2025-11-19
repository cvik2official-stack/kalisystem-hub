import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { Order, Item, OrderStatus, Unit } from '../../types';
import { useNotifier } from '../../context/NotificationContext';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemSelect: (item: Item) => void;
  order: Order;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onItemSelect, order }) => {
  const { state, actions } = useContext(AppContext);
  const { notify } = useNotifier();
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredItems = useMemo(() => {
    const itemsInOrder = new Set(order.items.map(i => i.itemId));
    // Filter items specifically for this supplier
    const availableItems = state.items.filter(i => !itemsInOrder.has(i.id) && i.supplierId === order.supplierId);

    const searchFiltered = !search
      ? availableItems
      : availableItems.filter(item => 
          item.name.toLowerCase().includes(search.toLowerCase())
        );
        
    return searchFiltered.sort((a, b) => a.name.localeCompare(b.name));
  }, [search, state.items, order.items, order.supplierId]);

  const handleItemClick = (item: Item) => {
    onItemSelect(item);
    setSearch('');
    onClose();
  };
  
  const handleAddNewItem = async () => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) return;

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

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
        <div className={`relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md border-t-4 ${
            order.status === OrderStatus.DISPATCHING ? 'border-blue-500' :
            order.status === OrderStatus.ON_THE_WAY ? 'border-yellow-500' :
            'border-green-500'
        }`} onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
          </button>
          <h2 className="text-xl font-bold text-white mb-4">
            Add Item to <span className="font-mono font-semibold tracking-wider">{order.supplierName}</span>
          </h2>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
            </div>
            <input
                type="text"
                id="add-item-search-input"
                name="add-item-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full bg-gray-900 text-gray-200 rounded-md p-3 pl-10 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Search or type to create..."
            />
          </div>

          <div className="mt-4 max-h-60 overflow-y-auto space-y-1 hide-scrollbar">
              {filteredItems.length === 0 ? (
                search.trim() ? (
                    <div className="text-center py-4">
                        <p className="text-gray-500 mb-4">No existing item named "{search}".</p>
                        <button
                            onClick={handleAddNewItem}
                            disabled={isCreating}
                            className="w-full text-center p-3 rounded-md text-indigo-400 hover:bg-indigo-600 hover:text-white font-semibold disabled:text-gray-500 disabled:cursor-wait transition-colors duration-150 outline-none"
                        >
                            {isCreating ? 'Creating...' : `+ Create "${search.trim()}"`}
                        </button>
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-4">
                        Type to search or add items.
                    </p>
                )
              ) : (
                filteredItems.map(item => (
                  <button key={item.id} onClick={() => handleItemClick(item)} className="w-full text-left p-3 rounded-md hover:bg-indigo-600 transition-colors duration-150 outline-none flex justify-between items-center group">
                      <p className="text-gray-300 group-hover:text-white">{item.name}</p>
                      <span className="text-gray-500 text-xs group-hover:text-gray-300">{item.unit}</span>
                  </button>
                ))
              )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AddItemModal;