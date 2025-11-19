import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { StoreName } from '../../types';

interface SelectStoreForShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoreSelect: (store: StoreName) => void;
}

const SelectStoreForShareModal: React.FC<SelectStoreForShareModalProps> = ({ isOpen, onClose, onStoreSelect }) => {
  const { state } = useContext(AppContext);
  const { stores } = state;

  if (!isOpen) {
    return null;
  }

  const handleSelect = (storeName: StoreName) => {
    onStoreSelect(storeName);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-white mb-6">Select a Store</h2>
        
        <div className="flex flex-col space-y-2">
          {stores.sort((a, b) => a.name.localeCompare(b.name)).map(store => (
            <button
              key={store.id}
              onClick={() => handleSelect(store.name)}
              className="w-full text-center px-4 py-3 rounded-md text-sm font-semibold transition-all duration-150 bg-indigo-600/50 text-indigo-200 hover:bg-indigo-600 hover:text-white"
            >
              {store.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SelectStoreForShareModal;
