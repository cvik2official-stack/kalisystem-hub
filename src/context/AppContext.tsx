import React, { createContext, useReducer, ReactNode, Dispatch, useEffect, useCallback } from 'react';
import { Item, Order, OrderItem, OrderStatus, Store, StoreName, Supplier, Unit } from '../types';
import { getItemsAndSuppliersFromSupabase, getOrdersFromSupabase, addOrder as supabaseAddOrder, updateOrder as supabaseUpdateOrder, deleteOrder as supabaseDeleteOrder, addItem as supabaseAddItem, updateItem as supabaseUpdateItem, deleteItem as supabaseDeleteItem, updateSupplier as supabaseUpdateSupplier } from '../services/supabaseService';
import { useToasts } from './ToastContext';
import { processCsvContent } from '../services/csvService';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface AppState {
  stores: Store[];
  activeStore: StoreName | 'Settings';
  suppliers: Supplier[];
  items: Item[];
  orders: Order[];
  activeStatus: OrderStatus;
  orderIdCounters: Record<string, number>;
  settings: {
    supabaseUrl?: string;
    supabaseKey?: string;
    telegramToken?: string;
    csvUrl?: string;
    isAiEnabled?: boolean;
    lastSyncedCsvContent?: string;
  };
  isLoading: boolean;
  isInitialized: boolean;
  syncStatus: SyncStatus;
}

export type Action =
  | { type: 'SET_ACTIVE_STORE'; payload: StoreName | 'Settings' }
  | { type: 'SET_ACTIVE_STATUS'; payload: OrderStatus }
  | { type: '_ADD_ITEM'; payload: Item }
  | { type: '_UPDATE_ITEM'; payload: Item }
  | { type: '_DELETE_ITEM'; payload: string }
  | { type: '_UPDATE_SUPPLIER'; payload: Supplier }
  | { type: 'ADD_ORDERS'; payload: Order[] }
  | { type: 'UPDATE_ORDER'; payload: Order }
  | { type: 'DELETE_ORDER'; payload: string }
  | { type: 'SAVE_SETTINGS'; payload: AppState['settings'] }
  | { type: 'REPLACE_ITEM_DATABASE'; payload: { items: Item[], suppliers: Supplier[], rawCsv: string } }
  | { type: '_SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: '_MERGE_DATABASE'; payload: { items: Item[], suppliers: Supplier[], orders: Order[] } }
  | { type: 'INITIALIZATION_COMPLETE' };

export interface AppContextActions {
    addItem: (item: Omit<Item, 'id'>) => Promise<void>;
    updateItem: (item: Item) => Promise<void>;
    deleteItem: (itemId: string) => Promise<void>;
    updateSupplier: (supplier: Supplier) => Promise<void>;
    addOrder: (supplier: Supplier, store: StoreName, items?: OrderItem[]) => Promise<void>;
    updateOrder: (order: Order) => Promise<void>;
    deleteOrder: (orderId: string) => Promise<void>;
    syncWithSupabase: () => Promise<void>;
}


const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_ACTIVE_STORE':
      return { ...state, activeStore: action.payload };
    case 'SET_ACTIVE_STATUS':
      return { ...state, activeStatus: action.payload };
    case '_ADD_ITEM':
        return { ...state, items: [...state.items, action.payload] };
    case '_UPDATE_ITEM': {
        const updatedItem = action.payload;
        return { 
            ...state,
            items: state.items.map(i => i.id === updatedItem.id ? updatedItem : i),
            orders: state.orders.map(o => ({
                ...o,
                items: o.items.map(oi => oi.itemId === updatedItem.id ? { ...oi, name: updatedItem.name, unit: updatedItem.unit } : oi)
            }))
        };
    }
    case '_DELETE_ITEM':
        return { ...state, items: state.items.filter(i => i.id !== action.payload) };
    case '_UPDATE_SUPPLIER':
        return { ...state, suppliers: state.suppliers.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'ADD_ORDERS': {
        const newOrders = action.payload.filter(
            newOrder => !state.orders.some(existingOrder => existingOrder.id === newOrder.id)
        );
        return { ...state, orders: [...state.orders, ...newOrders] };
    }
    case 'UPDATE_ORDER': {
        const updatedOrder = action.payload;
        return { ...state, orders: state.orders.map(o => o.id === updatedOrder.id ? updatedOrder : o) };
    }
    case 'DELETE_ORDER': {
        return { ...state, orders: state.orders.filter(o => o.id !== action.payload) };
    }
    case 'SAVE_SETTINGS': {
        return { ...state, settings: action.payload };
    }
    case 'REPLACE_ITEM_DATABASE': {
      const { items, suppliers, rawCsv } = action.payload;
      return {
        ...state,
        items,
        suppliers,
        settings: {
          ...state.settings,
          lastSyncedCsvContent: rawCsv,
        },
      };
    }
    case '_SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload, isLoading: action.payload === 'syncing' };
    case '_MERGE_DATABASE': {
        const { items, suppliers, orders: remoteOrders } = action.payload;
        const localOrdersMap = new Map(state.orders.map(o => [o.id, o]));
        const mergedOrders: Order[] = [];

        for (const remoteOrder of remoteOrders) {
            const localOrder = localOrdersMap.get(remoteOrder.id);
            if (localOrder) {
                if (new Date(remoteOrder.modifiedAt) > new Date(localOrder.modifiedAt)) {
                    mergedOrders.push(remoteOrder);
                } else {
                    mergedOrders.push(localOrder);
                }
                localOrdersMap.delete(remoteOrder.id);
            } else {
                mergedOrders.push(remoteOrder);
            }
        }

        localOrdersMap.forEach(localOrder => mergedOrders.push(localOrder));

        return { ...state, items, suppliers, orders: mergedOrders };
    }
    case 'INITIALIZATION_COMPLETE':
      return { ...state, isInitialized: true };
    default:
      return state;
  }
};

const APP_STATE_KEY = 'supplyChainCommanderState_v3';

const getInitialState = (): AppState => {
  let loadedState: AppState | undefined;
  try {
    const serializedState = localStorage.getItem(APP_STATE_KEY);
    if (serializedState) {
      loadedState = JSON.parse(serializedState);
    }
  } catch (err) {
    console.warn("Could not load state from localStorage", err);
  }

  const initialState: AppState = {
    stores: Object.values(StoreName).map(name => ({ name })),
    activeStore: StoreName.CV2,
    suppliers: [],
    items: [],
    orders: [],
    activeStatus: OrderStatus.DISPATCHING,
    orderIdCounters: {},
    settings: {
      supabaseUrl: 'https://expwmqozywxbhewaczju.supabase.co',
      supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4cHdtcW96eXd4Ymhld2Fjemp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2Njc5MjksImV4cCI6MjA3NzI0MzkyOX0.Tf0g0yIZ3pd-OcNrmLEdozDt9eT7Fn0Mjlu8BHt1vyg',
      csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQbOvxfGpbbvY9fzyOBYFdQ6M2_N2kR-hIQxalGpb4y7ZaDANOx9AglF3k8axXzJA-mLcbwKfvHuTYO/pub?gid=472324130&single=true&output=csv',
      isAiEnabled: true,
    },
    isLoading: false,
    isInitialized: false,
    syncStatus: 'idle',
  };

  if (loadedState) {
    loadedState.orders = (loadedState.orders as any[]).map(o => {
      const { lastUpdate, ...rest } = o;
      return {
        ...rest,
        createdAt: o.createdAt || new Date(0).toISOString(),
        modifiedAt: o.modifiedAt || lastUpdate || new Date().toISOString(),
      };
    });

    loadedState.settings = { ...initialState.settings, ...loadedState.settings };
    loadedState.stores = initialState.stores;
    loadedState.isLoading = false;
    loadedState.isInitialized = false;
    return loadedState;
  }
  return initialState;
};

export const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<Action>;
  actions: AppContextActions;
}>({
  state: getInitialState(),
  dispatch: () => null,
  actions: {
      addItem: async () => {},
      updateItem: async () => {},
      deleteItem: async () => {},
      updateSupplier: async () => {},
      addOrder: async () => {},
      updateOrder: async () => {},
      deleteOrder: async () => {},
      syncWithSupabase: async () => {},
  }
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, getInitialState());
  const { addToast } = useToasts();
  
  useEffect(() => {
    try {
        const stateToSave = { ...state, isLoading: false, isInitialized: true };
        const serializedState = JSON.stringify(stateToSave);
        localStorage.setItem(APP_STATE_KEY, serializedState);
    } catch(err) {
        console.error("Could not save state to localStorage", err);
    }
  }, [state]);

  const syncWithSupabase = useCallback(async () => {
    dispatch({ type: '_SET_SYNC_STATUS', payload: 'syncing' });
    try {
        if (!navigator.onLine) {
            addToast('Offline mode. Using cached data.', 'info');
            dispatch({ type: '_SET_SYNC_STATUS', payload: 'offline' });
            return;
        }

        const { supabaseUrl, supabaseKey } = state.settings;
        
        if (supabaseUrl && supabaseKey) {
            addToast('Syncing with Supabase...', 'info');
            
            const { items, suppliers } = await getItemsAndSuppliersFromSupabase({ url: supabaseUrl, key: supabaseKey });
            const orders = await getOrdersFromSupabase({ url: supabaseUrl, key: supabaseKey });
            
            dispatch({ type: '_MERGE_DATABASE', payload: { items, suppliers, orders } }); 
            addToast('Sync complete.', 'success');
            dispatch({ type: '_SET_SYNC_STATUS', payload: 'idle' });
        } else {
            addToast('Supabase not configured. Using cached data.', 'info');
            dispatch({ type: '_SET_SYNC_STATUS', payload: 'idle' });
        }
    } catch (e: any) {
        addToast(`Supabase sync failed: ${e.message}. Using cache.`, 'error');
        dispatch({ type: '_SET_SYNC_STATUS', payload: 'error' });
    }
}, [state.settings, addToast, dispatch]);


  useEffect(() => {
    if (!state.isInitialized) {
      // Immediately render the app with cached data
      dispatch({ type: 'INITIALIZATION_COMPLETE' });
      // Begin background sync
      syncWithSupabase();
    }
  }, [state.isInitialized, syncWithSupabase]);

  const actions: AppContextActions = {
    addItem: async (item: Omit<Item, 'id'>) => {
        const { supabaseUrl, supabaseKey } = state.settings;
        if (!supabaseUrl || !supabaseKey) {
            addToast('Supabase not configured.', 'error'); throw new Error('Supabase not configured');
        }
        try {
            const newItem = await supabaseAddItem({ item, url: supabaseUrl, key: supabaseKey });
            dispatch({ type: '_ADD_ITEM', payload: newItem });
            addToast(`Item "${newItem.name}" created.`, 'success');
        } catch (e: any) { addToast(`Error: ${e.message}`, 'error'); throw e; }
    },
    updateItem: async (item: Item) => {
        const { supabaseUrl, supabaseKey } = state.settings;
        if (!supabaseUrl || !supabaseKey) {
            addToast('Supabase not configured.', 'error'); throw new Error('Supabase not configured');
        }
        try {
            const updatedItem = await supabaseUpdateItem({ item, url: supabaseUrl, key: supabaseKey });
            dispatch({ type: '_UPDATE_ITEM', payload: updatedItem });
            addToast(`Item "${updatedItem.name}" updated.`, 'success');
        } catch (e: any) { addToast(`Error: ${e.message}`, 'error'); throw e; }
    },
    deleteItem: async (itemId: string) => {
        const { supabaseUrl, supabaseKey } = state.settings;
        if (!supabaseUrl || !supabaseKey) {
            addToast('Supabase not configured.', 'error'); throw new Error('Supabase not configured');
        }
        try {
            await supabaseDeleteItem({ itemId, url: supabaseUrl, key: supabaseKey });
            dispatch({ type: '_DELETE_ITEM', payload: itemId });
            addToast('Item deleted.', 'success');
        } catch (e: any) { addToast(`Error: ${e.message}`, 'error'); throw e; }
    },
    updateSupplier: async (supplier: Supplier) => {
        const { supabaseUrl, supabaseKey } = state.settings;
        if (!supabaseUrl || !supabaseKey) {
            addToast('Supabase not configured.', 'error'); throw new Error('Supabase not configured');
        }
        try {
            const updatedSupplier = await supabaseUpdateSupplier({ supplier, url: supabaseUrl, key: supabaseKey });
            dispatch({ type: '_UPDATE_SUPPLIER', payload: updatedSupplier });
            addToast(`Supplier "${updatedSupplier.name}" updated.`, 'success');
        } catch (e: any) { addToast(`Error: ${e.message}`, 'error'); throw e; }
    },
    addOrder: async (supplier, store, items = []) => {
        const { supabaseUrl, supabaseKey } = state.settings;
        if (!supabaseUrl || !supabaseKey) {
            addToast('Supabase not configured.', 'error'); throw new Error('Supabase not configured');
        }
        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}${ (now.getMonth() + 1).toString().padStart(2, '0')}`;
        const counterKey = `${dateStr}_${supplier.name}_${store}`;
        const newCounter = (state.orderIdCounters[counterKey] || 0) + 1;
        const newOrderId = `${dateStr}_${supplier.name}_${store}_${String(newCounter).padStart(3,'0')}`;
        const newOrder: Order = {
            id: `placeholder_${Date.now()}`, // This ID is temporary and will be replaced by the one from the DB
            orderId: newOrderId, store, supplierId: supplier.id, supplierName: supplier.name, items, status: OrderStatus.DISPATCHING,
            isSent: false, isReceived: false, createdAt: now.toISOString(), modifiedAt: now.toISOString(),
        };
        try {
            const savedOrder = await supabaseAddOrder({ order: newOrder, url: supabaseUrl, key: supabaseKey });
            dispatch({ type: 'ADD_ORDERS', payload: [savedOrder] });
            addToast(`Order for ${supplier.name} created.`, 'success');
        } catch (e: any) { addToast(`Error: ${e.message}`, 'error'); throw e; }
    },
    updateOrder: async (order) => {
        const { supabaseUrl, supabaseKey } = state.settings;
        if (!supabaseUrl || !supabaseKey) {
            addToast('Supabase not configured.', 'error'); throw new Error('Supabase not configured');
        }
        try {
            const updatedOrder = await supabaseUpdateOrder({ order, url: supabaseUrl, key: supabaseKey });
            dispatch({ type: 'UPDATE_ORDER', payload: updatedOrder });
        } catch (e: any) { addToast(`Error: ${e.message}`, 'error'); throw e; }
    },
    deleteOrder: async (orderId) => {
        const { supabaseUrl, supabaseKey } = state.settings;
        if (!supabaseUrl || !supabaseKey) {
            addToast('Supabase not configured.', 'error'); throw new Error('Supabase not configured');
        }
        try {
            await supabaseDeleteOrder({ orderId, url: supabaseUrl, key: supabaseKey });
            dispatch({ type: 'DELETE_ORDER', payload: orderId });
            addToast(`Order deleted.`, 'success');
        } catch (e: any) { addToast(`Error: ${e.message}`, 'error'); throw e; }
    },
    syncWithSupabase,
  };

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
};