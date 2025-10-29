import React, { useContext, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { StoreName } from '../types';
import { useToasts } from '../context/ToastContext';

const StoreTabs: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const { stores, activeStore } = state;
  const { addToast } = useToasts();
  const longPressTimer = useRef<number | null>(null);

  const allTabs = stores.map(s => s.name);

  const handlePressStart = (storeName: StoreName) => {
    // Set a timer for the long-press action
    longPressTimer.current = window.setTimeout(() => {
      const url = new URL(window.location.href);
      url.hash = `/?view=manager&store=${storeName}`;
      navigator.clipboard.writeText(url.href).then(() => {
        addToast(`Manager link for ${storeName} copied!`, 'success');
      });
    }, 500); // 500ms for a long press
  };

  const handlePressEnd = () => {
    // Clear the timer if the press is released before it fires
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = (tabName: StoreName) => {
    dispatch({ type: 'SET_ACTIVE_STORE', payload: tabName });
  };


  return (
    <div className="border-b border-gray-700">
      <nav className="-mb-px flex space-x-6" aria-label="Tabs">
        {allTabs.map((tabName) => (
          <button
            key={tabName}
            onClick={() => handleClick(tabName as StoreName)}
            onMouseDown={() => handlePressStart(tabName as StoreName)}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd} // Also cancel if the mouse leaves the button
            onTouchStart={() => handlePressStart(tabName as StoreName)}
            onTouchEnd={handlePressEnd}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeStore === tabName
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }
            `}
          >
            {tabName}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default StoreTabs;