import React, { useContext } from 'react';
import { StoreName } from '../../types';
import { AppContext } from '../../context/AppContext';

interface MoveToStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (store: StoreName) => void;
  currentStore: StoreName;
}

const MoveToStoreModal: React.FC<MoveToStoreModalProps> = ({ isOpen, onClose, onSelect, currentStore }) => {
  const { state } = useContext(AppContext);
  const { stores } = state;

  if (!isOpen) return null;

  const handleSelect = (storeName: StoreName) => {
    onSelect(storeName);
    onClose();
  };

  const availableStores = stores.filter(s => s.name !== currentStore).sort((a,b) => a.name.localeCompare(b.name));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-white mb-6">Move Order To...</h2>
        
        <div className="flex flex-col space-y-2">
          {availableStores.length > 0 ? (
            availableStores.map(store => (
              <button
                key={store.id}
                onClick={() => handleSelect(store.name)}
                className="w-full text-center px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 bg-indigo-900/50 text-indigo-300 hover:bg-indigo-600 hover:text-white"
              >
                {store.name}
              </button>
            ))
          ) : (
            <p className="text-gray-500 text-center">No other stores available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoveToStoreModal;