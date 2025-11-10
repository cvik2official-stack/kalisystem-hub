import React, { useContext, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { Store, StoreName } from '../types';
import { useNotifier } from '../context/NotificationContext';

const StoreTabs: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const { stores, activeStore } = state;
  const { notify } = useNotifier();
  const longPressTimer = useRef<number | null>(null);

  const handleClick = (tabName: StoreName) => {
    // Prevent long-press action on a normal click
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    dispatch({ type: 'SET_ACTIVE_STORE', payload: tabName });
  };

  const copyManagerUrl = (storeName: StoreName) => {
    const url = `${window.location.origin}${window.location.pathname}#/?view=manager&store=${storeName}`;
    navigator.clipboard.writeText(url).then(() => {
        notify(`Manager URL for ${storeName} copied!`, 'success');
    }).catch(err => {
        notify(`Failed to copy URL: ${err}`, 'error');
    });
  };

  const handlePressStart = (storeName: StoreName) => {
    // Clear any existing timer to avoid conflicts
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    
    longPressTimer.current = window.setTimeout(() => {
        copyManagerUrl(storeName);
    }, 500); // 500ms for a long press
  };

  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // Create a comprehensive list of all stores from the enum.
  const allStoreNames: StoreName[] = Object.values(StoreName);
  const storesFromStateMap = new Map(stores.map(s => [s.name, s]));
  const allStoresWithPlaceholders: Store[] = allStoreNames.map(name => {
      return storesFromStateMap.get(name) || { id: `enum_store_${name}`, name: name };
  });

  // Sort stores to ensure consistent order, with CV2 always first.
  // FIX: Explicitly typed sort callback parameters to resolve type inference failure.
  const sortedStores = [...allStoresWithPlaceholders].sort((a: Store, b: Store) => {
    if (a.name === StoreName.CV2) return -1;
    if (b.name === StoreName.CV2) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      <nav className="-mb-px flex space-x-6" aria-label="Tabs">
        {sortedStores.map(({ name }) => (
          <button
            key={name}
            onClick={() => handleClick(name)}
            onMouseDown={() => handlePressStart(name)}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={() => handlePressStart(name)}
            onTouchEnd={handlePressEnd}
            className={`
              whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm
              ${
                activeStore === name
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }
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