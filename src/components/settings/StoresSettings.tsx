


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
  VALUES ('CV2'), ('STOCKO2'), ('WB'), ('SHANTI'), ('OUDOM'), ('KALI')
  ON CONFLICT (name) DO NOTHING;

*/
import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { Store } from '../../types';
import ResizableTable from '../common/ResizableTable';

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
      id: 'name', header: 'Store Name', initialWidth: 200,
      cell: (store: Store) => <span className="text-white whitespace-nowrap truncate max-w-xs">{store.name}</span>
    },
    {
      id: 'chatId', header: 'Chat ID', initialWidth: 200,
      cell: (store: Store) => (
        <input
          type="text"
          defaultValue={store.chatId || ''}
          onBlur={(e) => handleStoreUpdate(store, 'chatId', e.target.value)}
          className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 font-mono"
        />
      )
    },
    {
      id: 'locationUrl', header: 'Location URL', initialWidth: 400,
      cell: (store: Store) => (
        <div className="truncate">
            <input
              type="text"
              defaultValue={store.locationUrl || ''}
              onBlur={(e) => handleStoreUpdate(store, 'locationUrl', e.target.value)}
              className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 font-mono truncate"
            />
        </div>
      )
    },
  ], [state.stores]);


  return (
    <div className="flex flex-col flex-grow">
      <ResizableTable
        columns={columns}
        data={sortedStores}
        tableKey="stores-settings"
      />
    </div>
  );
};

export default StoresSettings;