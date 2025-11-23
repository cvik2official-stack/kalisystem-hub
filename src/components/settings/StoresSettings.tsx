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
  VALUES ('CV2'), ('STOCKO2'), ('WB'), ('SHANTI'), ('KALI')
  ON CONFLICT (name) DO NOTHING;

*/
import React, { useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { Store } from '../../types';

const StoresSettings: React.FC = () => {
  const { state, actions } = useContext(AppContext);

  const handleStoreUpdate = async (store: Store, field: keyof Store, value: string) => {
    await actions.updateStore({ ...store, [field]: value });
  };
  
  const sortedStores = useMemo(() => {
    return [...state.stores].sort((a, b) => a.name.localeCompare(b.name));
  }, [state.stores]);

  const columns = useMemo(() => [
    { 
      id: 'name', header: 'Store Name',
      cell: (store: Store) => <span className="text-white whitespace-nowrap truncate max-w-xs">{store.name}</span>
    },
    {
      id: 'chatId', header: 'Chat ID',
      cell: (store: Store) => (
        <input
          type="text"
          defaultValue={store.chatId || ''}
          onBlur={(e) => handleStoreUpdate(store, 'chatId', e.target.value)}
          className="bg-transparent p-1 w-full rounded focus:bg-gray-900 outline-none font-mono text-gray-300 focus:text-white"
        />
      )
    },
    {
      id: 'locationUrl', header: 'Location URL',
      cell: (store: Store) => (
        <div className="truncate">
            <input
              type="text"
              defaultValue={store.locationUrl || ''}
              onBlur={(e) => handleStoreUpdate(store, 'locationUrl', e.target.value)}
              className="bg-transparent p-1 w-full rounded focus:bg-gray-900 outline-none font-mono truncate text-gray-300 focus:text-white"
            />
        </div>
      )
    },
  ], [state.stores]);


  return (
    <div className="flex flex-col flex-grow w-full lg:w-3/4">
      <div className="overflow-x-auto hide-scrollbar">
          <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-transparent border-b border-gray-800">
                  <tr>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[200px]">Store Name</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[200px]">Chat ID</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[400px]">Location URL</th>
                  </tr>
              </thead>
              <tbody className="bg-transparent divide-y divide-gray-800">
                  {sortedStores.map(store => (
                      <tr key={store.id} className="hover:bg-gray-800/30 transition-colors">
                          {columns.map(col => (
                              <td key={col.id} className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">
                                  {col.cell(store)}
                              </td>
                          ))}
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
};

export default StoresSettings;