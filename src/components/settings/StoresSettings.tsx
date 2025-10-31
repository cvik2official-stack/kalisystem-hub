import React, { useContext, useState, useRef, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { Store, StoreName } from '../../types';

const StoresSettings: React.FC = () => {
  const { state, actions } = useContext(AppContext);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const longPressTimer = useRef<number | null>(null);

  const storesForTable = useMemo(() => {
    const kaliStore = { name: 'KALI' as StoreName };
    return [...state.stores, kaliStore].sort((a, b) => a.name.localeCompare(b.name));
  }, [state.stores]);

  const handleEdit = (store: Store) => {
    setEditingId(store.name);
    setEditingValue(state.settings.spreadsheetIds?.[store.name] || '');
  };

  const handleSave = async () => {
    if (!editingId) return;
    
    await actions.updateStoreConfig(editingId, editingValue);

    setEditingId(null);
  };
  
  const handlePressStart = (store: Store) => {
    longPressTimer.current = window.setTimeout(() => {
        handleEdit(store);
    }, 500);
  };

  const handlePressEnd = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };


  return (
    <div className="flex flex-col flex-grow">
      <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col w-full md:w-3/4">
        <div className="flex-grow overflow-y-auto hide-scrollbar">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="pl-4 pr-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Store Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Spreadsheet ID</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {storesForTable.map(store => (
                <tr key={store.name} className="hover:bg-gray-700/50">
                  <td className="pl-4 pr-6 py-2 text-sm text-white whitespace-nowrap">{store.name}</td>
                   <td 
                    className="px-6 py-2 text-sm text-gray-300 font-mono cursor-pointer"
                    onClick={() => handleEdit(store)}
                    onMouseDown={() => handlePressStart(store)}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={() => handlePressStart(store)}
                    onTouchEnd={handlePressEnd}
                  >
                    {editingId === store.name ? (
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="w-full bg-gray-700 text-gray-200 rounded-md p-1 outline-none ring-1 ring-indigo-500"
                      />
                    ) : (
                      state.settings.spreadsheetIds?.[store.name] || <span className="text-gray-500">Not set</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StoresSettings;