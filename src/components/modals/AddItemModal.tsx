

import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { Order, OrderItem, Item, OrderStatus } from '../../types';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: OrderItem) => void;
  order: Order;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onAddItem, order }) => {
  const { state } = useContext(AppContext);
  const [search, setSearch] = useState('');

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
    onAddItem({
      itemId: item.id,
      name: item.name,
      quantity: 1,
      unit: item.unit,
    });
    setSearch('');
    onClose();
  };
  
  const handleAddNewItem = () => {
    onAddItem({
      itemId: `new_${Date.now()}_${Math.random()}`,
      name: search,
      quantity: 1,
      unit: undefined, // Default unit, can be changed later
    });
    setSearch('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
        <div className={`relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 border-t-4 ${
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
          
          <input
              type="text"
              placeholder="Search for an item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full bg-gray-900 text-gray-200 rounded-md p-3 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
          />

          <div className="mt-4 max-h-60 overflow-y-auto space-y-1 hide-scrollbar">
              {filteredItems.length === 0 ? (
                search.trim() ? (
                    <div className="text-center py-4">
                        <p className="text-gray-500 mb-4">No item named "{search}".</p>
                        <button
                            onClick={handleAddNewItem}
                            className="w-full text-center p-2 rounded-md text-indigo-400 hover:bg-gray-700 hover:text-indigo-300 font-semibold"
                        >
                            + Add "{search}"
                        </button>
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-4">
                        {state.items.length > 0 ? "No items found." : "No items configured in the system."}
                    </p>
                )
              ) : (
                filteredItems.map(item => (
                  <button key={item.id} onClick={() => handleItemClick(item)} className="w-full text-left p-2 rounded-md hover:bg-gray-700 flex justify-between items-center">
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