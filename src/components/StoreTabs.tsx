
import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Store, StoreName } from '../types';

const StoreTabs: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { stores, activeStore, draggedOrderId, orders } = state;
  const [dragOverStore, setDragOverStore] = useState<StoreName | 'ALL' | null>(null);

  const handleClick = (tabName: StoreName | 'ALL') => {
    dispatch({ type: 'SET_ACTIVE_STORE', payload: tabName });
  };

  // Create a comprehensive list of all stores from the enum.
  const allStoreNames = Object.values(StoreName) as StoreName[];
  const storesFromStateMap = new Map(stores.map(s => [s.name, s]));
  const allStoresWithPlaceholders: Store[] = allStoreNames.map((name): Store => {
      return storesFromStateMap.get(name) || { id: `enum_store_${name}`, name: name };
  });

  // Sort stores to ensure consistent order, with CV2 always first.
  const sortedStores = [...allStoresWithPlaceholders].sort((a: Store, b: Store) => {
    if (a.name === StoreName.CV2) return -1;
    if (b.name === StoreName.CV2) return 1;
    return a.name.localeCompare(b.name);
  });

  const handleDragOver = (e: React.DragEvent, storeName: StoreName) => {
      if (draggedOrderId) {
          const draggedOrder = orders.find(o => o.id === draggedOrderId);
          if (draggedOrder && draggedOrder.store !== storeName) {
              e.preventDefault();
              setDragOverStore(storeName);
          }
      }
  };

  const handleDrop = (e: React.DragEvent, storeName: StoreName) => {
      if (draggedOrderId) {
          e.preventDefault();
          const draggedOrder = orders.find(o => o.id === draggedOrderId);
          if (draggedOrder && draggedOrder.store !== storeName) {
              actions.updateOrder({ ...draggedOrder, store: storeName });
          }
          setDragOverStore(null);
          // Also clear the global dragged order ID to finalize the drag operation
          dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: null });
      }
  };

  return (
    <div className="flex-grow overflow-x-auto overflow-y-hidden hide-scrollbar flex justify-start md:justify-center">
      <nav className="flex space-x-2 px-1" aria-label="Tabs">
        <button
            key="ALL"
            onClick={() => handleClick('ALL')}
            className={`
              whitespace-nowrap py-2 px-2 border-b-2 font-medium text-sm transition-colors rounded-t-md
              ${
                activeStore === 'ALL'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }
            `}
          >
            ALL
          </button>
        {sortedStores.map(({ name }) => (
          <button
            key={name}
            onClick={() => handleClick(name)}
            onDragOver={(e) => handleDragOver(e, name)}
            onDragLeave={() => setDragOverStore(null)}
            onDrop={(e) => handleDrop(e, name)}
            className={`
              whitespace-nowrap py-2 px-2 border-b-2 font-medium text-sm transition-colors rounded-t-md
              ${
                activeStore === name
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }
              ${ dragOverStore === name ? 'bg-indigo-900/50' : ''}
            `}
          >
            {name}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default StoreTabs;
