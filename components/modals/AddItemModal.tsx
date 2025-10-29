
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
    
    // Filter items by supplier of the current order card
    const availableItemsForSupplier = state.items.filter(i => i.supplierId === order.supplierId && !itemsInOrder.has(i.id));

    const searchFiltered = !search
      ? availableItemsForSupplier
      : availableItemsForSupplier.filter(item => 
          item.name.toLowerCase().includes(search.toLowerCase())
        );
        
    return searchFiltered.sort((a, b) => a.name.localeCompare(b.name));
  }, [search, state.items, order.items, order.supplierId]);

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
          <h2 className="text-xl font-bold text-white mb-4">Add Item to {order.supplierName}</h2>
          
          <input
              type="text"
              placeholder="Search for an item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-3 focus:ring-2 focus:ring-indigo-500"
          />

          <div className="mt-4 max-h-60 overflow-y-auto space-y-1 hide-scrollbar">
              {filteredItems.map(item => (
                  <button key={item.id} onClick={() => handleItemClick(item)} className="w-full text-left p-2 rounded-md hover:bg-gray-700 flex justify-between items-center">
                      <p className="text-gray-300">{item.name}</p>
                  </button>
              ))}
              {filteredItems.length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                      {state.items.filter(i => i.supplierId === order.supplierId).length > 0 ? "No matching items found." : "No items configured for this supplier."}
                  </p>
              )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AddItemModal;
