import React, { createContext, useReducer, ReactNode, Dispatch, useEffect, useCallback } from 'react';
import { Item, Order, OrderItem, OrderStatus, Store, StoreName, Supplier, SupplierName, Unit } from '../types';
import { getItemsAndSuppliersFromSupabase, getOrdersFromSupabase, addOrder as supabaseAddOrder, updateOrder as supabaseUpdateOrder, deleteOrder as supabaseDeleteOrder, addItem as supabaseAddItem, updateItem as supabaseUpdateItem, deleteItem as supabaseDeleteItem, updateSupplier as supabaseUpdateSupplier, addSupplier as supabaseAddSupplier, getStoreConfigsFromSupabase, upsertStoreConfigInSupabase } from '../services/supabaseService';
import { useToasts } from './ToastContext';
import { generateAndRunDailyReports } from '../services/reportingService';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface AppState {
  stores: Store[];
  activeStore: StoreName | 'Settings' | 'KALI';
  suppliers: Supplier[];
  items: Item[];
  orders: Order[];
  activeStatus: OrderStatus;
  orderIdCounters: Record<string, number>;
  settings: {
    supabaseUrl: string; // Made non-optional as it's required
    supabaseKey: string; // Made non-optional as it's required
    isAiEnabled?: boolean;
    lastSyncedCsvContent?: string;
    // FIX: Added optional properties to support integration settings.
    csvUrl?: string;
    geminiApiKey?: string;
    spreadsheetIds?: Partial<Record<string, string>>;
  };
  isLoading: boolean;
  isInitialized: boolean;
  syncStatus: SyncStatus;
  isManagerView: boolean;
  managerStoreFilter: StoreName | null;
}

export type Action =
  | { type: 'SET_ACTIVE_STORE'; payload: StoreName | 'Settings' | 'KALI' }
  | { type: 'SET_ACTIVE_STATUS'; payload: OrderStatus }
  | { type: '_ADD_ITEM'; payload: Item }
  | { type: '_UPDATE_ITEM'; payload: Item }
  | { type: '_DELETE_ITEM'; payload: string }
  | { type: '_ADD_SUPPLIER'; payload: Supplier }
  | { type: '_UPDATE_SUPPLIER'; payload: Supplier }
  | { type: 'ADD_ORDERS'; payload: Order[] }
  | { type: 'UPDATE_ORDER'; payload: Order }
  | { type: 'DELETE_ORDER'; payload: string }
  | { type: 'SAVE_SETTINGS'; payload: Partial<AppState['settings']> }
  | { type: 'REPLACE_ITEM_DATABASE'; payload: { items: Item[], suppliers: Supplier[], rawCsv: string } }
  | { type: '_SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: '_MERGE_DATABASE'; payload: { items: Item[], suppliers: Supplier[], orders: Order[] } }
  | { type: 'INITIALIZATION_COMPLETE' }
  | { type: 'SET_STORE_CONFIGS'; payload: { spreadsheetIds: Record<string, string> } }
  | { type: 'SET_MANAGER_VIEW'; payload: { isManager: boolean; store: StoreName | null } };

export interface AppContextActions {
    addItem: (item: Omit<Item, 'id'>) => Promise<Item>;
    updateItem: (item: Item) => Promise<void>;
    deleteItem: (itemId: string) => Promise<void>;
    updateSupplier: (supplier: Supplier) => Promise<void>;
    addOrder: (supplier: Supplier, store: StoreName, items?: OrderItem[]) => Promise<void>;
    updateOrder: (order: Order) => Promise<void>;
    deleteOrder: (orderId: string) => Promise<void>;
    updateStoreConfig: (storeName: string, spreadsheetId: string) => Promise<void>;
    syncWithSupabase: () => Promise<void>;
    runDailyReports: () => Promise<void>;
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
    case '_ADD_SUPPLIER':
        if (state.suppliers.some(s => s.id === action.payload.id)) {
            return state;
        }
        return { ...state, suppliers: [...state.suppliers, action.payload] };
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
        return { ...state, settings: { ...state.settings, ...action.payload } };
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
        const { items: remoteItems, suppliers: remoteSuppliers, orders: remoteOrders } = action.payload;
        const mergedItemsMap = new Map(remoteItems.map(i => [i.id, i]));
        state.items.forEach(localItem => !mergedItemsMap.has(localItem.id) && mergedItemsMap.set(localItem.id, localItem));
        const mergedSuppliersMap = new Map(remoteSuppliers.map(s => [s.id, s]));
        state.suppliers.forEach(localSupplier => !mergedSuppliersMap.has(localSupplier.id) && mergedSuppliersMap.set(localSupplier.id, localSupplier));
        const localOrdersMap = new Map(state.orders.map(o => [o.id, o]));
        const mergedOrders: Order[] = [];
        for (const remoteOrder of remoteOrders) {
            const localOrder = localOrdersMap.get(remoteOrder.id);
            if (localOrder) {
                mergedOrders.push(new Date(remoteOrder.modifiedAt) > new Date(localOrder.modifiedAt) ? remoteOrder : localOrder);
                localOrdersMap.delete(remoteOrder.id);
            } else {
                mergedOrders.push(remoteOrder);
            }
        }
        localOrdersMap.forEach(localOrder => mergedOrders.push(localOrder));

        return { 
            ...state, 
            items: Array.from(mergedItemsMap.values()), 
            suppliers: Array.from(mergedSuppliersMap.values()), 
            orders: mergedOrders 
        };
    }
    case 'INITIALIZATION_COMPLETE':
      return { ...state, isInitialized: true };
    case 'SET_STORE_CONFIGS': {
      return {
        ...state,
        settings: {
          ...state.settings,
          spreadsheetIds: action.payload.spreadsheetIds,
        }
      };
    }
    case 'SET_MANAGER_VIEW':
        return {
            ...state,
            isManagerView: action.payload.isManager,
            managerStoreFilter: action.payload.store,
        };
    default:
      return state;
  }
};

const APP_STATE_KEY = 'supplyChainCommanderState_v3';

const getInitialState = (): AppState => {
  let loadedState: Partial<AppState> = {};
  try {
    const serializedState = localStorage.getItem(APP_STATE_KEY);
    if (serializedState) loadedState = JSON.parse(serializedState);
  } catch (err) { console.warn("Could not load state from localStorage", err); }

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
      isAiEnabled: true,
      spreadsheetIds: {},
    },
    isLoading: false,
    isInitialized: false,
    syncStatus: 'idle',
    isManagerView: false,
    managerStoreFilter: null,
  };

  const finalState = { ...initialState, ...loadedState };
  finalState.settings = { ...initialState.settings, ...loadedState.settings };
  finalState.orders = (loadedState.orders || []).map((o: Partial<Order>) => ({
      ...o,
      createdAt: o.createdAt || new Date(0).toISOString(),
      modifiedAt: o.modifiedAt || new Date().toISOString(),
  })) as Order[];
  finalState.isLoading = false;
  finalState.isInitialized = false;

  return finalState;
};

export const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<Action>;
  actions: AppContextActions;
}>({
  state: getInitialState(),
  dispatch: () => null,
  actions: {
      addItem: async () => { throw new Error('addItem not implemented'); },
      updateItem: async () => {}, deleteItem: async () => {},
      updateSupplier: async () => {}, addOrder: async () => {},
      updateOrder: async () => {}, deleteOrder: async () => {},
      updateStoreConfig: async () => {},
      syncWithSupabase: async () => {},
      runDailyReports: async () => {},
  }
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, getInitialState());
  const { addToast } = useToasts();
  
  useEffect(() => {
    try {
        const stateToSave = { ...state, isLoading: false, isInitialized: true };
        localStorage.setItem(APP_STATE_KEY, JSON.stringify(stateToSave));
    } catch(err) { console.error("Could not save state to localStorage", err); }
  }, [state]);

  const syncWithSupabase = useCallback(async () => {
    dispatch({ type: '_SET_SYNC_STATUS', payload: 'syncing' });
    try {
        if (!navigator.onLine) {
            addToast('Offline. Using cached data.', 'info');
            return dispatch({ type: '_SET_SYNC_STATUS', payload: 'offline' });
        }
        const { supabaseUrl, supabaseKey } = state.settings;
        addToast('Syncing with database...', 'info');

        const { items, suppliers } = await getItemsAndSuppliersFromSupabase({ url: supabaseUrl, key: supabaseKey });
        const [orders, storeConfigs] = await Promise.all([
            getOrdersFromSupabase({ url: supabaseUrl, key: supabaseKey, suppliers }),
            getStoreConfigsFromSupabase({ url: supabaseUrl, key: supabaseKey })
        ]);
        
        dispatch({ type: '_MERGE_DATABASE', payload: { items, suppliers, orders } }); 
        dispatch({ type: 'SET_STORE_CONFIGS', payload: storeConfigs });
        
        addToast('Sync complete.', 'success');
        dispatch({ type: '_SET_SYNC_STATUS', payload: 'idle' });
    } catch (e: any) {
        addToast(`Sync failed: ${e.message}. Using cache.`, 'error');
        dispatch({ type: '_SET_SYNC_STATUS', payload: 'error' });
    }
  }, [state.settings, addToast, dispatch]);

  useEffect(() => {
    if (!state.isInitialized) {
      dispatch({ type: 'INITIALIZATION_COMPLETE' });
      syncWithSupabase();
    }
  }, [state.isInitialized, syncWithSupabase]);

  const actions: AppContextActions = {
    addItem: async (item) => {
        const newItem = await supabaseAddItem({ item, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: '_ADD_ITEM', payload: newItem });
        addToast(`Item "${newItem.name}" created.`, 'success');
        return newItem;
    },
    updateItem: async (item) => {
        const updatedItem = await supabaseUpdateItem({ item, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: '_UPDATE_ITEM', payload: updatedItem });
        addToast(`Item "${updatedItem.name}" updated.`, 'success');
    },
    deleteItem: async (itemId) => {
        await supabaseDeleteItem({ itemId, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: '_DELETE_ITEM', payload: itemId });
        addToast('Item deleted.', 'success');
    },
    updateSupplier: async (supplier) => {
        const updatedSupplier = await supabaseUpdateSupplier({ supplier, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: '_UPDATE_SUPPLIER', payload: updatedSupplier });
        addToast(`Supplier "${updatedSupplier.name}" updated.`, 'success');
    },
    addOrder: async (supplier, store, items = []) => {
        let supplierToUse = supplier;
        if (supplier.id.startsWith('new_')) {
            addToast(`Verifying supplier: ${supplier.name}...`, 'info');
            const newSupplierFromDb = await supabaseAddSupplier({ supplierName: supplier.name, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
            dispatch({ type: '_ADD_SUPPLIER', payload: newSupplierFromDb });
            supplierToUse = newSupplierFromDb;
        }
        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}${ (now.getMonth() + 1).toString().padStart(2, '0')}`;
        const counterKey = `${dateStr}_${supplierToUse.name}_${store}`;
        const newCounter = (state.orderIdCounters[counterKey] || 0) + 1;
        const newOrderId = `${dateStr}_${supplierToUse.name}_${store}_${String(newCounter).padStart(3,'0')}`;
        const newOrder: Order = {
            id: `placeholder_${Date.now()}`, orderId: newOrderId, store, supplierId: supplierToUse.id, supplierName: supplierToUse.name, items, status: OrderStatus.DISPATCHING,
            isSent: false, isReceived: false, createdAt: now.toISOString(), modifiedAt: now.toISOString(),
        };
        const savedOrder = await supabaseAddOrder({ order: newOrder, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: 'ADD_ORDERS', payload: [savedOrder] });
        addToast(`Order for ${supplierToUse.name} created.`, 'success');
    },
    updateOrder: async (order) => {
        const updatedOrder = await supabaseUpdateOrder({ order, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: 'UPDATE_ORDER', payload: updatedOrder });
    },
    deleteOrder: async (orderId) => {
        await supabaseDeleteOrder({ orderId, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: 'DELETE_ORDER', payload: orderId });
        addToast(`Order deleted.`, 'success');
    },
    updateStoreConfig: async (storeName, spreadsheetId) => {
        await upsertStoreConfigInSupabase({
            storeName,
            spreadsheetId,
            url: state.settings.supabaseUrl,
            key: state.settings.supabaseKey
        });

        dispatch({
            type: 'SAVE_SETTINGS',
            payload: {
                spreadsheetIds: {
                    ...state.settings.spreadsheetIds,
                    [storeName]: spreadsheetId.trim(),
                },
            }
        });
        addToast(`Settings for ${storeName} saved.`, 'success');
    },
    runDailyReports: async () => {
        addToast('Generating daily reports...', 'info');
        await generateAndRunDailyReports({
            stores: state.stores,
            orders: state.orders,
            settings: state.settings,
            supabaseCreds: { url: state.settings.supabaseUrl, key: state.settings.supabaseKey },
        });
        addToast('Daily reports completed.', 'success');
    },
    syncWithSupabase,
  };

  for (const actionName in actions) {
      const originalAction = (actions as any)[actionName];
      (actions as any)[actionName] = async (...args: any[]) => {
          try {
              return await originalAction(...args);
          } catch (e: any) {
              addToast(`Error: ${e.message}`, 'error');
              throw e;
          }
      };
  }

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
};