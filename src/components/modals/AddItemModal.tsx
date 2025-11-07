import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { Order, OrderItem, Item, OrderStatus, Unit } from '../../types';
import { useNotifier } from '../../context/NotificationContext';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: OrderItem) => void;
  order: Order;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onAddItem, order }) => {
  const { state, actions } = useContext(AppContext);
  const { notify } = useNotifier();
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredItems = useMemo(() => {
    // Exclude items already in the order
    const itemsInOrder = new Set(order.items.map(i => i.itemId));
    
    // Show all items, regardless of supplier, excluding those already in the order
    const availableItems = state.items.filter(i => !itemsInOrder.has(i.id));

    const searchFiltered = !search
      ? availableItems
      : availableItems.filter(item => 
          item.name.toLowerCase().includes(search.toLowerCase())
        );
        
    return searchFiltered.sort((a, b) => a.name.localeCompare(b.name));
  }, [search, state.items, order.items]);

  const handleItemClick = (item: Item) => {
    // FIX: Look for the price from the ORDER's supplier, not the item's default supplier.
    const masterPrice = state.itemPrices.find(p => p.itemId === item.id && p.supplierId === order.supplierId && p.isMaster);
    onAddItem({
      itemId: item.id,
      name: item.name,
      quantity: 1,
      unit: item.unit,
      price: masterPrice?.price,
    });
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

        // Find any item with this name, regardless of its primary supplier
        const existingItemInDb = state.items.find(i => i.name.toLowerCase() === trimmedSearch.toLowerCase());
        
        let itemToAdd: Item;

        if (existingItemInDb) {
            // A master item with this name already exists. We'll use it.
            itemToAdd = existingItemInDb;
        } else {
            // No master item found. Create a new one with the current order's supplier as its primary.
            notify(`Creating new master item: ${trimmedSearch}`, 'info');
            itemToAdd = await actions.addItem({
                name: trimmedSearch,
                supplierId: supplier.id,
                supplierName: supplier.name,
                unit: Unit.PC, // Default unit
            });
        }
        
        // Now, regardless of whether the item was found or created, look for its price
        // from the CURRENT order's supplier.
        const masterPrice = state.itemPrices.find(p => p.itemId === itemToAdd.id && p.supplierId === order.supplierId && p.isMaster);

        onAddItem({
            itemId: itemToAdd.id,
            name: itemToAdd.name,
            quantity: 1, // default quantity
            unit: itemToAdd.unit,
            price: masterPrice?.price,
        });
        
        setSearch('');
        onClose();
    } catch (e) {
        // Error toast is handled by the context action
        console.error("Failed to create and add new item:", e);
    } finally {
        setIsCreating(false);
    }
  };

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
                placeholder="Search or add a new item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full bg-gray-900 text-gray-200 rounded-md p-3 pl-10 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="mt-4 max-h-60 overflow-y-auto space-y-1 hide-scrollbar">
              {filteredItems.length === 0 ? (
                search.trim() ? (
                    <div className="text-center py-4">
                        <p className="text-gray-500 mb-4">No item named "{search}".</p>
                        <button
                            onClick={handleAddNewItem}
                            disabled={isCreating}
                            className="w-full text-center p-3 rounded-md text-indigo-400 hover:bg-indigo-600 hover:text-white font-semibold disabled:text-gray-500 disabled:cursor-wait transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                        >
                            {isCreating ? 'Creating...' : `+ Add "${search.trim()}"`}
                        </button>
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-4">
                        {state.items.length > 0 ? "No items found." : "No items configured in the system."}
                    </p>
                )
              ) : (
                filteredItems.map(item => (
                  <button key={item.id} onClick={() => handleItemClick(item)} className="w-full text-left p-3 rounded-md hover:bg-indigo-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500">
                      <p className="text-gray-300">{item.name}</p>
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