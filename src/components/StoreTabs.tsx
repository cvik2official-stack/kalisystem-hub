import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Store, StoreName } from '../types';
import { stringToColorClass } from '../constants';

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
        {sortedStores.map(({ name }) => {
          // Use the centralized color logic for consistent styling
          const colorClass = stringToColorClass(name);
          // Extract just the text color part for the active state if needed, or use the whole class string
          // The stringToColorClass returns 'bg-X text-Y border-Z'. 
          // We want a border-bottom style here. Let's approximate by parsing or using a simpler mapping if strictly needed.
          // However, the requirement was "apply corresponding store tag color".
          
          // Let's match the existing style pattern: border-color and text-color.
          // We can cheat and use the text color from the class string by regex or just manual mapping if robust.
          // But let's try to just apply the class when active for the text color, and map border manually?
          // Or better, just use the text color class.
          
          const isActive = activeStore === name;
          // Extract the color name (e.g., 'yellow', 'blue') from the class string to build the border class dynamically
          const colorMatch = colorClass.match(/text-(\w+)-300/);
          const colorName = colorMatch ? colorMatch[1] : 'indigo';
          
          return (
            <button
              key={name}
              onClick={() => handleClick(name)}
              onDragOver={(e) => handleDragOver(e, name)}
              onDragLeave={() => setDragOverStore(null)}
              onDrop={(e) => handleDrop(e, name)}
              className={`
                whitespace-nowrap py-2 px-2 border-b-2 font-medium text-sm transition-colors rounded-t-md
                ${
                  isActive
                    ? `border-${colorName}-500 text-${colorName}-400`
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                }
                ${ dragOverStore === name ? 'bg-indigo-900/50' : ''}
              `}
            >
              {name}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default StoreTabs;