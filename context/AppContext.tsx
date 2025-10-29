import React, { createContext, useReducer, ReactNode, Dispatch, useEffect, useCallback } from 'react';
import { Item, Order, OrderItem, OrderStatus, Store, StoreName, Supplier, Unit } from '../types';
import { getItemsAndSuppliersFromSupabase, addItem as supabaseAddItem, updateItem as supabaseUpdateItem, deleteItem as supabaseDeleteItem, updateSupplier as supabaseUpdateSupplier } from '../services/supabaseService';
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
  isLoading: boolean; // Now represents background sync status
  isInitialized: boolean; // Represents if cache has been loaded
  syncStatus: SyncStatus;
}

// All actions are now internal to the context after the database operation succeeds.
// Components will call the new async functions instead.
export type Action =
  | { type: 'SET_ACTIVE_STORE'; payload: StoreName | 'Settings' }
  | { type: 'SET_ACTIVE_STATUS'; payload: OrderStatus }
  | { type: '_ADD_ITEM'; payload: Item }
  | { type: '_UPDATE_ITEM'; payload: Item }
  | { type: '_DELETE_ITEM'; payload: string }
  | { type: '_UPDATE_SUPPLIER'; payload: Supplier }
  | { type: 'ADD_ORDERS'; payload: Order[] }
  | { type: 'ADD_EMPTY_ORDER'; payload: { supplier: Supplier; store: StoreName } }
  | { type: 'UPDATE_ORDER'; payload: Order }
  | { type: 'DELETE_ORDER'; payload: string }
  | { type: 'DELETE_ORDER_ITEM'; payload: { orderId: string; itemId: string } }
  | { type: 'UPDATE_ORDER_ITEM'; payload: { orderId: string; itemId: string; quantity: number; unit?: Unit } }
  | { type: 'ADD_ITEM_TO_ORDER'; payload: { orderId: string; item: OrderItem } }
  | { type: 'MOVE_ITEM_BETWEEN_ORDERS'; payload: { sourceOrderId: string; destOrderId: string; item: OrderItem } }
  | { type: 'SPOIL_ITEM'; payload: { orderId: string; item: OrderItem, store: StoreName } }
  | { type: 'SAVE_SETTINGS'; payload: AppState['settings'] }
  // FIX: Add REPLACE_ITEM_DATABASE action type to support CSV sync functionality from the settings page.
  | { type: 'REPLACE_ITEM_DATABASE'; payload: { items: Item[], suppliers: Supplier[], rawCsv: string } }
  | { type: '_SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: '_MERGE_DATABASE'; payload: { items: Item[], suppliers: Supplier[], orders: Order[] } }
  | { type: 'INITIALIZATION_COMPLETE' };

// --- NEW Database-aware functions ---
export interface AppContextActions {
    addItem: (item: Omit<Item, 'id'>) => Promise<void>;
    updateItem: (item: Item) => Promise<void>;
    deleteItem: (itemId: string) => Promise<void>;
    updateSupplier: (supplier: Supplier) => Promise<void>;
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
    // Order-related actions remain the same as they are local-only for now
    case 'ADD_ORDERS':
        return { ...state, orders: [...state.orders, ...action.payload] };
    case 'ADD_EMPTY_ORDER': {
        const { supplier, store } = action.payload;
        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}${ (now.getMonth() + 1).toString().padStart(2, '0')}`;
        const counterKey = `${dateStr}_${supplier.name}_${store}`;
        const newCounter = (state.orderIdCounters[counterKey] || 0) + 1;
        const newOrderId = `${dateStr}_${supplier.name}_${store}_${String(newCounter).padStart(3,'0')}`;

        const newOrder: Order = {
            id: `ord_${Date.now()}`,
            orderId: newOrderId,
            store,
            supplierId: supplier.id,
            supplierName: supplier.name,
            items: [],
            status: OrderStatus.DISPATCHING,
            isSent: false,
            isReceived: false,
            createdAt: now.toISOString(),
            modifiedAt: now.toISOString(),
        };
        return { ...state, orders: [...state.orders, newOrder], orderIdCounters: { ...state.orderIdCounters, [counterKey]: newCounter } };
    }
    case 'UPDATE_ORDER': {
        const now = new Date().toISOString();
        const updatedOrder = action.payload;
        if (updatedOrder.status === OrderStatus.COMPLETED && !updatedOrder.completedAt) {
          updatedOrder.completedAt = now;
        }
        return { ...state, orders: state.orders.map(o => o.id === updatedOrder.id ? {...updatedOrder, modifiedAt: now } : o) };
    }
    case 'DELETE_ORDER': {
        return { ...state, orders: state.orders.filter(o => o.id !== action.payload) };
    }
    case 'ADD_ITEM_TO_ORDER': {
        return {
            ...state,
            orders: state.orders.map(order => {
                if (order.id !== action.payload.orderId) return order;
                const existingItem = order.items.find(i => i.itemId === action.payload.item.itemId);
                if (existingItem) {
                    return { ...order, modifiedAt: new Date().toISOString(), items: order.items.map(i => i.itemId === existingItem.itemId ? { ...i, quantity: i.quantity + action.payload.item.quantity } : i) };
                }
                return { ...order, modifiedAt: new Date().toISOString(), items: [...order.items, action.payload.item] };
            })
        };
    }
    case 'UPDATE_ORDER_ITEM': {
        return {
            ...state,
            orders: state.orders.map(order => 
                order.id === action.payload.orderId 
                ? { ...order, modifiedAt: new Date().toISOString(), items: order.items.map(item => item.itemId === action.payload.itemId ? { ...item, quantity: action.payload.quantity, unit: action.payload.unit } : item) } 
                : order
            )
        };
    }
    case 'DELETE_ORDER_ITEM': {
        return {
            ...state,
            orders: state.orders.map(order => 
                order.id === action.payload.orderId 
                ? { ...order, modifiedAt: new Date().toISOString(), items: order.items.filter(item => item.itemId !== action.payload.itemId) } 
                : order
            )
        };
    }
    case 'MOVE_ITEM_BETWEEN_ORDERS': {
        const { sourceOrderId, destOrderId, item } = action.payload;
        const now = new Date().toISOString();
        return {
            ...state,
            orders: state.orders.map(order => {
                if (order.id === sourceOrderId) {
                    return { ...order, modifiedAt: now, items: order.items.filter(i => i.itemId !== item.itemId) };
                }
                if (order.id === destOrderId) {
                     const existingItem = order.items.find(i => i.itemId === item.itemId);
                     if (existingItem) {
                         return { ...order, modifiedAt: now, items: order.items.map(i => i.itemId === item.itemId ? { ...i, quantity: i.quantity + item.quantity } : i) };
                     }
                    return { ...order, modifiedAt: now, items: [...order.items, item] };
                }
                return order;
            })
        };
    }
     case 'SPOIL_ITEM': {
        const { orderId, item, store } = action.payload;
        const itemOrigin = state.items.find(i => i.id === item.itemId);
        if (!itemOrigin) return state;

        const now = new Date();
        let spoiledOrderExists = false;
        const updatedOrders = state.orders.map(order => {
            if (order.id === orderId) {
                return {
                    ...order,
                    modifiedAt: now.toISOString(),
                    items: order.items.map(i => i.itemId === item.itemId ? { ...i, isSpoiled: true } : i),
                };
            }
            if (order.store === store && order.supplierId === itemOrigin.supplierId && order.status === OrderStatus.DISPATCHING) {
                spoiledOrderExists = true;
                const existingItem = order.items.find(i => i.itemId === item.itemId);
                 if (existingItem) {
                    return { ...order, modifiedAt: now.toISOString(), items: order.items.map(i => i.itemId === item.itemId ? { ...i, quantity: i.quantity + item.quantity } : i) };
                 }
                return { ...order, modifiedAt: now.toISOString(), items: [...order.items, { ...item, isSpoiled: false }] };
            }
            return order;
        });

        if (!spoiledOrderExists) {
            const dateStr = `${now.getDate().toString().padStart(2, '0')}${ (now.getMonth() + 1).toString().padStart(2, '0')}`;
            const counterKey = `${dateStr}_${itemOrigin.supplierName}_${store}`;
            const newCounter = (state.orderIdCounters[counterKey] || 0) + 1;
            const newOrderId = `${dateStr}_${itemOrigin.supplierName}_${store}_${String(newCounter).padStart(3,'0')}`;
            
            const newOrder: Order = {
                id: `ord_spoiled_${Date.now()}`,
                orderId: newOrderId,
                store: store,
                supplierId: itemOrigin.supplierId,
                supplierName: itemOrigin.supplierName,
                items: [{...item, isSpoiled: false }],
                status: OrderStatus.DISPATCHING,
                isSent: false, 
                isReceived: false,
                createdAt: now.toISOString(),
                modifiedAt: now.toISOString(),
            };
            updatedOrders.push(newOrder);
            return { ...state, orders: updatedOrders, orderIdCounters: { ...state.orderIdCounters, [counterKey]: newCounter } };
        }

        return { ...state, orders: updatedOrders };
    }
    case 'SAVE_SETTINGS': {
        return { ...state, settings: action.payload };
    }
    // FIX: Add reducer case for REPLACE_ITEM_DATABASE to handle data from CSV sync.
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

        // Merge remote orders into local state
        for (const remoteOrder of remoteOrders) {
            const localOrder = localOrdersMap.get(remoteOrder.id);
            if (localOrder) {
                // Conflict resolution: newest `modifiedAt` wins
                if (new Date(remoteOrder.modifiedAt) > new Date(localOrder.modifiedAt)) {
                    mergedOrders.push(remoteOrder);
                } else {
                    mergedOrders.push(localOrder);
                }
                localOrdersMap.delete(remoteOrder.id); // Mark as processed
            } else {
                // New order from remote
                mergedOrders.push(remoteOrder);
            }
        }

        // Add any remaining local-only orders (e.g., created offline)
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
      csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQbOvxfGpbbvY9fzyOBYFdQ6M2_N2kR-hIQxalGpb4y7ZaDANOx9AglF3k8axXzJA-mLcbwKfvHuTYO/pub?gid=472324130&single=true&output=csv',
      isAiEnabled: true,
    },
    isLoading: false, // Will be true only during background sync
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
    loadedState.isInitialized = false; // Mark as not initialized until cache is loaded
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

  const loadInitialData = useCallback(async () => {
    dispatch({ type: '_SET_SYNC_STATUS', payload: 'syncing' });
    try {
      if (navigator.onLine) {
        const { supabaseUrl, supabaseKey, csvUrl } = state.settings;
        
        if (supabaseUrl && supabaseKey) {
          try {
            addToast('Connecting to Supabase...', 'info');
            const { items, suppliers } = await getItemsAndSuppliersFromSupabase({ url: supabaseUrl, key: supabaseKey });
            dispatch({ type: '_MERGE_DATABASE', payload: { items, suppliers, orders: [] } }); 
            addToast('Database loaded from Supabase.', 'success');
            dispatch({ type: '_SET_SYNC_STATUS', payload: 'idle' });
            return; 
          } catch (e: any) {
            addToast(`Supabase failed: ${e.message}. Using cached data.`, 'error');
            dispatch({ type: '_SET_SYNC_STATUS', payload: 'error' });
            return;
          }
        }

        if (csvUrl) {
          try {
            addToast('Fetching data from CSV...', 'info');
            const response = await fetch(csvUrl);
            if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
            const csvText = await response.text();
            const { items, suppliers } = processCsvContent(csvText);
            dispatch({ type: 'REPLACE_ITEM_DATABASE', payload: { items, suppliers, rawCsv: csvText } });
            addToast('Database loaded from CSV.', 'success');
            dispatch({ type: '_SET_SYNC_STATUS', payload: 'idle' });
            return;
          } catch (e: any) {
            addToast(`Failed to load from CSV: ${e.message}`, 'error');
            dispatch({ type: '_SET_SYNC_STATUS', payload: 'error' });
          }
        }

        addToast('Online, but no data source found. Using cached version.', 'info');
        dispatch({ type: '_SET_SYNC_STATUS', payload: 'idle' });

      } else {
        addToast('Offline mode. Using cached data.', 'info');
        dispatch({ type: '_SET_SYNC_STATUS', payload: 'offline' });
      }
    } finally {
      dispatch({ type: 'INITIALIZATION_COMPLETE' });
    }
  }, [state.settings, addToast, dispatch]);

  useEffect(() => {
    if (!state.isInitialized) {
      loadInitialData();
    }
  }, [state.isInitialized, loadInitialData]);

  const actions: AppContextActions = {
    addItem: async (item: Omit<Item, 'id'>) => {
        const { supabaseUrl, supabaseKey } = state.settings;
        if (!supabaseUrl || !supabaseKey) {
            addToast('Supabase not configured. Cannot save item.', 'error');
            throw new Error('Supabase not configured');
        }
        try {
            const newItem = await supabaseAddItem({ item, url: supabaseUrl, key: supabaseKey });
            dispatch({ type: '_ADD_ITEM', payload: newItem });
            addToast(`Item "${newItem.name}" created.`, 'success');
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            throw e;
        }
    },
    updateItem: async (item: Item) => {
        const { supabaseUrl, supabaseKey } = state.settings;
        if (!supabaseUrl || !supabaseKey) {
            addToast('Supabase not configured. Cannot save item.', 'error');
            throw new Error('Supabase not configured');
        }
        try {
            const updatedItem = await supabaseUpdateItem({ item, url: supabaseUrl, key: supabaseKey });
            dispatch({ type: '_UPDATE_ITEM', payload: updatedItem });
            addToast(`Item "${updatedItem.name}" updated.`, 'success');
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            throw e;
        }
    },
    deleteItem: async (itemId: string) => {
        const { supabaseUrl, supabaseKey } = state.settings;
        if (!supabaseUrl || !supabaseKey) {
            addToast('Supabase not configured. Cannot delete item.', 'error');
            throw new Error('Supabase not configured');
        }
        try {
            await supabaseDeleteItem({ itemId, url: supabaseUrl, key: supabaseKey });
            dispatch({ type: '_DELETE_ITEM', payload: itemId });
            addToast('Item deleted.', 'success');
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            throw e;
        }
    },
    updateSupplier: async (supplier: Supplier) => {
        const { supabaseUrl, supabaseKey } = state.settings;
        if (!supabaseUrl || !supabaseKey) {
            addToast('Supabase not configured. Cannot update supplier.', 'error');
            throw new Error('Supabase not configured');
        }
        try {
            const updatedSupplier = await supabaseUpdateSupplier({ supplier, url: supabaseUrl, key: supabaseKey });
            dispatch({ type: '_UPDATE_SUPPLIER', payload: updatedSupplier });
            addToast(`Supplier "${updatedSupplier.name}" updated.`, 'success');
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
            throw e;
        }
    }
  };

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
};
