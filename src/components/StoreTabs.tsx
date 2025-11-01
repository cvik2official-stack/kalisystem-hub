import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { StoreName } from '../types';

const StoreTabs: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const { stores, activeStore } = state;

  const handleClick = (tabName: StoreName) => {
    dispatch({ type: 'SET_ACTIVE_STORE', payload: tabName });
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