/*
  NOTE FOR DATABASE SETUP:
  This component manages store properties that require the 'stores' table.
  Please ensure it exists and is populated by running the following SQL commands
  in your Supabase SQL Editor:

  -- 1. Create the stores table
  CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    chat_id TEXT,
    location_url TEXT
  );

  -- 2. Seed the table with your store names (run this once)
  INSERT INTO public.stores (name)
  VALUES ('CV2'), ('STOCK02'), ('WB'), ('SHANTI'), ('OUDOM'), ('KALI')
  ON CONFLICT (name) DO NOTHING;

*/
import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { Store } from '../../types';

const StoresSettings: React.FC = () => {
  const { state, actions } = useContext(AppContext);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editedStoreData, setEditedStoreData] = useState<Partial<Store>>({});

  const handleEditClick = (store: Store) => {
    setEditingStoreId(store.id);
    setEditedStoreData(store);
  };

  const handleCancelEdit = () => {
    setEditingStoreId(null);
    setEditedStoreData({});
  };

  const handleInlineSave = async () => {
    if (editingStoreId && editedStoreData) {
      await actions.updateStore(editedStoreData as Store);
      setEditingStoreId(null);
      setEditedStoreData({});
    }
  };

  const handleStoreDataChange = (field: keyof Store, value: string) => {
    setEditedStoreData(prev => ({ ...prev, [field]: value }));
  };

  const sortedStores = useMemo(() => {
    return [...state.stores].sort((a, b) => a.name.localeCompare(b.name));
  }, [state.stores]);

  return (
    <div className="flex flex-col flex-grow">
      <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col w-full">
        <div className="flex-grow overflow-y-auto hide-scrollbar">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="pl-4 pr-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Store Name
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Chat ID
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Location URL
                </th>
                <th className="pl-2 pr-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {sortedStores.map(store => {
                const isEditing = editingStoreId === store.id;
                return (
                  <tr key={store.id} className="hover:bg-gray-700/50">
                    <td className="pl-4 pr-2 py-2 text-sm text-white whitespace-nowrap">{store.name}</td>
                    <td className="px-2 py-1 text-sm text-gray-300 whitespace-nowrap font-mono">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedStoreData.chatId || ''}
                          onChange={(e) => handleStoreDataChange('chatId', e.target.value)}
                          className="bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-1 w-full"
                        />
                      ) : (
                        store.chatId || '-'
                      )}
                    </td>
                    <td className="px-2 py-1 text-sm text-gray-300 whitespace-nowrap font-mono">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedStoreData.locationUrl || ''}
                          onChange={(e) => handleStoreDataChange('locationUrl', e.target.value)}
                          className="bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-1 w-full"
                        />
                      ) : (
                        store.locationUrl || '-'
                      )}
                    </td>
                    <td className="pl-2 pr-4 py-1 text-right">
                       <div className="flex items-center justify-end space-x-2">
                          {isEditing ? (
                            <>
                              <button onClick={handleInlineSave} className="p-1 rounded-full text-green-400 hover:bg-green-600 hover:text-white" aria-label="Save store">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              </button>
                              <button onClick={handleCancelEdit} className="p-1 rounded-full text-red-400 hover:bg-red-600 hover:text-white" aria-label="Cancel edit">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleEditClick(store)}
                              className="p-1 rounded-full text-indigo-400 hover:bg-indigo-600 hover:text-white"
                              aria-label="Edit store"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StoresSettings;