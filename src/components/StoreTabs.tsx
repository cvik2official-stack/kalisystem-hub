import React, { useContext, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { StoreName } from '../types';
import { useToasts } from '../context/ToastContext';

const StoreTabs: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const { stores, activeStore } = state;
  const { addToast } = useToasts();
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
        addToast(`Manager URL for ${storeName} copied!`, 'success');
    }).catch(err => {
        addToast(`Failed to copy URL: ${err}`, 'error');
    });
  };

  const handleContextMenu = (e: React.MouseEvent, storeName: StoreName) => {
    e.preventDefault();
    copyManagerUrl(storeName);
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

  // Sort stores to ensure consistent order, with CV2 always first.
  const sortedStores = [...stores].sort((a, b) => {
    if (a.name === StoreName.CV2) return -1;
    if (b.name === StoreName.CV2) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="border-b border-gray-700">
      <nav className="-mb-px flex space-x-6" aria-label="Tabs">
        {sortedStores.map(({ name }) => (
          <button
            key={name}
            onClick={() => handleClick(name)}
            onContextMenu={(e) => handleContextMenu(e, name)}
            onMouseDown={() => handlePressStart(name)}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={() => handlePressStart(name)}
            onTouchEnd={handlePressEnd}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
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