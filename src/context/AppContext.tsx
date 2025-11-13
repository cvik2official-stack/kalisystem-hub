import React, { createContext, useReducer, useEffect, ReactNode, useContext, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AppState, StoreName, OrderStatus, SettingsTab, Store, Supplier, Item, ItemPrice, Order, SyncStatus, AppSettings, OrderItem, PaymentMethod, SupplierName } from '../types';
import * as db from '../services/supabaseService';
import { useNotifier } from './NotificationContext';

const LOCAL_STORAGE_KEY = 'KALI_SYSTEM_STATE_V2';

type AppAction =
  | { type: 'INITIALIZE'; payload: Partial<AppState> }
  | { type: 'SET_ALL_DATA'; payload: { stores: Store[]; suppliers: Supplier[]; items: Item[]; itemPrices: ItemPrice[]; orders: Order[] } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: 'SET_ACTIVE_STORE'; payload: StoreName | 'Settings' }
  | { type: 'SET_ACTIVE_STATUS'; payload: OrderStatus }
  | { type: 'SET_ACTIVE_SETTINGS_TAB'; payload: SettingsTab }
  | { type: 'NAVIGATE_TO_SETTINGS'; payload: SettingsTab }
  | { type: 'SET_MANAGER_VIEW'; payload: { isManager: boolean; store: StoreName | null } }
  | { type: 'SET_EDIT_MODE'; payload: boolean }
  | { type: 'CYCLE_COLUMN_COUNT' }
  | { type: 'SET_DRAGGED_ORDER_ID'; payload: string | null }
  | { type: 'SET_DRAGGED_ITEM'; payload: { item: OrderItem; sourceOrderId: string } | null }
  | { type: 'UPSERT_ORDER'; payload: Order }
  | { type: 'DELETE_ORDER'; payload: string }
  | { type: 'UPSERT_ITEM'; payload: Item }
  | { type: 'DELETE_ITEM'; payload: string }
  | { type: 'UPSERT_SUPPLIER'; payload: Supplier }
  | { type: 'DELETE_SUPPLIER'; payload: string }
  | { type: 'UPSERT_STORE'; payload: Store }
  | { type: 'UPSERT_ITEM_PRICE'; payload: ItemPrice }
  | { type: 'SAVE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'INCREMENT_ORDER_COUNTER'; payload: StoreName };

const initialState: AppState = {
  stores: [],
  activeStore: StoreName.CV2,
  suppliers: [],
  items: [],
  itemPrices: [],
  orders: [],
  activeStatus: OrderStatus.DISPATCHING,
  activeSettingsTab: 'items',
  orderIdCounters: {},
  settings: {
    supabaseUrl: '',
    supabaseKey: '',
  },
  isLoading: true,
  isInitialized: false,
  syncStatus: 'idle',
  isManagerView: false,
  managerStoreFilter: null,
  isEditModeEnabled: false,
  isDualPaneMode: false,
  cardWidth: null,
  draggedOrderId: null,
  draggedItem: null,
  columnCount: 3,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'INITIALIZE':
      return { ...state, ...action.payload, isInitialized: true, isLoading: false };
    case 'SET_ALL_DATA':
      return { ...state, ...action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload };
    case 'SET_ACTIVE_STORE':
      return { ...state, activeStore: action.payload };
    case 'SET_ACTIVE_STATUS':
      return { ...state, activeStatus: action.payload };
    case 'SET_ACTIVE_SETTINGS_TAB':
        return { ...state, activeSettingsTab: action.payload };
    case 'NAVIGATE_TO_SETTINGS':
        return { ...state, activeStore: 'Settings', activeSettingsTab: action.payload };
    case 'SET_MANAGER_VIEW':
      return { ...state, isManagerView: action.payload.isManager, managerStoreFilter: action.payload.store };
    case 'SET_EDIT_MODE':
      return { ...state, isEditModeEnabled: action.payload };
    case 'CYCLE_COLUMN_COUNT':
      const newCount = state.columnCount === 3 ? 1 : state.columnCount + 1;
      return { ...state, columnCount: (newCount > 3 ? 1 : newCount) as 1 | 2 | 3 };
    case 'SET_DRAGGED_ORDER_ID':
      return { ...state, draggedOrderId: action.payload };
    case 'SET_DRAGGED_ITEM':
        return { ...state, draggedItem: action.payload };
    case 'UPSERT_ORDER':
        const orderExists = state.orders.some(o => o.id === action.payload.id);
        return { ...state, orders: orderExists ? state.orders.map(o => o.id === action.payload.id ? action.payload : o) : [...state.orders, action.payload] };
    case 'DELETE_ORDER':
        return { ...state, orders: state.orders.filter(o => o.id !== action.payload) };
    case 'UPSERT_ITEM':
        const itemExists = state.items.some(i => i.id === action.payload.id);
        return { ...state, items: itemExists ? state.items.map(i => i.id === action.payload.id ? action.payload : i) : [...state.items, action.payload] };
    case 'DELETE_ITEM':
        return { ...state, items: state.items.filter(i => i.id !== action.payload) };
    case 'UPSERT_SUPPLIER':
        const supplierExists = state.suppliers.some(s => s.id === action.payload.id);
        return { ...state, suppliers: supplierExists ? state.suppliers.map(s => s.id === action.payload.id ? action.payload : s) : [...state.suppliers, action.payload] };
    case 'DELETE_SUPPLIER':
        return { ...state, suppliers: state.suppliers.filter(s => s.id !== action.payload) };
    case 'UPSERT_STORE':
        const storeExists = state.stores.some(s => s.id === action.payload.id);
        return { ...state, stores: storeExists ? state.stores.map(s => s.id === action.payload.id ? action.payload : s) : [...state.stores, action.payload] };
    case 'UPSERT_ITEM_PRICE':
        const priceExists = state.itemPrices.some(p => p.id === action.payload.id);
        return { ...state, itemPrices: priceExists ? state.itemPrices.map(p => p.id === action.payload.id ? action.payload : p) : [...state.itemPrices, action.payload] };
    case 'SAVE_SETTINGS':
        const newSettings = { ...state.settings, ...action.payload };
        return { ...state, settings: newSettings };
    case 'INCREMENT_ORDER_COUNTER':
      const today = new Date().toISOString().split('T')[0];
      const counterKey = `${action.payload}-${today}`;
      const newCounters = { ...state.orderIdCounters, [counterKey]: (state.orderIdCounters[counterKey] || 0) + 1 };
      return { ...state, orderIdCounters: newCounters };
    default:
      return state;
  }
};

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  actions: Record<string, (...args: any[]) => Promise<any>>;
}

export const AppContext = createContext<AppContextType>({
  state: initialState,
  dispatch: () => null,
  actions: {},
});

const generateOrderId = (store: StoreName, counter: number) => {
    const prefix = store.substring(0, 2).toUpperCase();
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${prefix}${day}${month}-${String(counter).padStart(2, '0')}`;
};


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { notify } = useNotifier();

  useEffect(() => {
    const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedStateJSON) {
      try {
        const savedState = JSON.parse(savedStateJSON);
        dispatch({ type: 'INITIALIZE', payload: savedState });
        db.initializeSupabase(savedState.settings);
      } catch (error) {
        console.error("Failed to parse state from localStorage", error);
        dispatch({ type: 'INITIALIZE', payload: {} });
      }
    } else {
      dispatch({ type: 'INITIALIZE', payload: {} });
    }
  }, []);

  useEffect(() => {
    if (state.isInitialized) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  const withErrorHandling = useCallback((action: Function) => async (...args: any[]) => {
    try {
      return await action(...args);
    } catch (error: any) {
      console.error(error);
      notify(error.message || 'An unexpected error occurred.', 'error');
      throw error;
    }
  }, [notify]);
  
  const actions = useMemo(() => {
    const syncWithSupabase = withErrorHandling(async () => {
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
        try {
            const [stores, suppliers, items, itemPrices, orders] = await Promise.all([
                db.fetchStores(),
                db.fetchSuppliers(),
                db.fetchItems(),
                db.fetchItemPrices(),
                db.fetchOrders(),
            ]);
            dispatch({ type: 'SET_ALL_DATA', payload: { stores, suppliers, items, itemPrices, orders } });
            notify('Sync complete!', 'success');
        } finally {
            dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
        }
    });

    const addOrder = withErrorHandling(async (supplier: Supplier, storeName: StoreName, items: OrderItem[], status: OrderStatus = OrderStatus.DISPATCHING) => {
      const today = new Date().toISOString().split('T')[0];
      const counterKey = `${storeName}-${today}`;
      const newCounter = (state.orderIdCounters[counterKey] || 0) + 1;
      const orderId = generateOrderId(storeName, newCounter);

      const newOrder: Omit<Order, 'id' | 'createdAt' | 'modifiedAt'> & {id?: string} = {
        orderId,
        store: storeName,
        supplierId: supplier.id,
        supplierName: supplier.name,
        items,
        status,
        isSent: false,
        isReceived: false,
        paymentMethod: supplier.paymentMethod
      };
      
      const savedOrder = await db.upsertOrder(newOrder);
      dispatch({ type: 'UPSERT_ORDER', payload: savedOrder });
      dispatch({ type: 'INCREMENT_ORDER_COUNTER', payload: storeName });
      return savedOrder;
    });

    const updateOrder = withErrorHandling(async (order: Partial<Order> & { id: string }) => {
      const savedOrder = await db.upsertOrder({ ...order, modifiedAt: new Date().toISOString() });
      dispatch({ type: 'UPSERT_ORDER', payload: savedOrder });
      return savedOrder;
    });

    const deleteOrder = withErrorHandling(async (id: string) => {
        await db.deleteOrder(id);
        dispatch({ type: 'DELETE_ORDER', payload: id });
    });
    
    const mergeOrders = withErrorHandling(async (sourceOrderId: string, destinationOrderId: string) => {
      const sourceOrder = state.orders.find(o => o.id === sourceOrderId);
      const destinationOrder = state.orders.find(o => o.id === destinationOrderId);
      if(!sourceOrder || !destinationOrder) throw new Error("Could not find orders to merge.");

      const newItems = [...destinationOrder.items];
      sourceOrder.items.forEach(sourceItem => {
        const existingItemIndex = newItems.findIndex(i => i.itemId === sourceItem.itemId && i.isSpoiled === sourceItem.isSpoiled);
        if (existingItemIndex > -1) {
          newItems[existingItemIndex].quantity += sourceItem.quantity;
        } else {
          newItems.push(sourceItem);
        }
      });
      await updateOrder({ ...destinationOrder, items: newItems });
      await deleteOrder(sourceOrderId);
      notify('Orders merged', 'success');
    });

    const addItem = withErrorHandling(async (item: Omit<Item, 'id' | 'supplierName' | 'createdAt' | 'modifiedAt'> & {supplierName: SupplierName}) => {
        const savedItem = await db.upsertItem(item);
        dispatch({ type: 'UPSERT_ITEM', payload: savedItem });
        return savedItem;
    });

    const updateItem = withErrorHandling(async (item: Item) => {
        const savedItem = await db.upsertItem(item);
        dispatch({ type: 'UPSERT_ITEM', payload: savedItem });
        return savedItem;
    });

    const deleteItem = withErrorHandling(async (id: string) => {
        await db.deleteItem(id);
        dispatch({ type: 'DELETE_ITEM', payload: id });
    });
    
    const upsertItemPrice = withErrorHandling(async (itemPrice: Partial<ItemPrice>) => {
        const savedPrice = await db.upsertItemPrice(itemPrice);
        dispatch({ type: 'UPSERT_ITEM_PRICE', payload: savedPrice });
        return savedPrice;
    });

    const addSupplier = withErrorHandling(async (supplier: Omit<Supplier, 'id' | 'modifiedAt'>) => {
        const savedSupplier = await db.upsertSupplier(supplier);
        dispatch({ type: 'UPSERT_SUPPLIER', payload: savedSupplier });
        return savedSupplier;
    });

    const updateSupplier = withErrorHandling(async (supplier: Supplier) => {
        const savedSupplier = await db.upsertSupplier(supplier);
        dispatch({ type: 'UPSERT_SUPPLIER', payload: savedSupplier });
        return savedSupplier;
    });
    
    const deleteSupplier = withErrorHandling(async (id: string) => {
        await db.deleteSupplier(id);
        dispatch({ type: 'DELETE_SUPPLIER', payload: id });
    });

    const updateStore = withErrorHandling(async (store: Store) => {
        const savedStore = await db.upsertStore(store);
        dispatch({ type: 'UPSERT_STORE', payload: savedStore });
        return savedStore;
    });

    return { syncWithSupabase, addOrder, updateOrder, deleteOrder, mergeOrders, addItem, updateItem, deleteItem, upsertItemPrice, addSupplier, updateSupplier, deleteSupplier, updateStore };

  }, [state.orders, state.orderIdCounters, withErrorHandling]);

  const contextValue = { state, dispatch, actions };

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
}
