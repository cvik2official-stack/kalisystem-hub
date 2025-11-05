import React, { createContext, useReducer, ReactNode, Dispatch, useEffect, useCallback } from 'react';
import { Item, Order, OrderItem, OrderStatus, Store, StoreName, Supplier, SupplierName, Unit, ItemPrice, PaymentMethod, AppSettings, SyncStatus, SettingsTab } from '../types';
import { getItemsAndSuppliersFromSupabase, getOrdersFromSupabase, addOrder as supabaseAddOrder, updateOrder as supabaseUpdateOrder, deleteOrder as supabaseDeleteOrder, addItem as supabaseAddItem, updateItem as supabaseUpdateItem, deleteItem as supabaseDeleteItem, updateSupplier as supabaseUpdateSupplier, addSupplier as supabaseAddSupplier, updateStore as supabaseUpdateStore, supabaseUpsertItemPrice } from '../services/supabaseService';
import { useNotifier } from './NotificationContext';

export interface AppState {
  stores: Store[];
  activeStore: StoreName | 'Settings';
  suppliers: Supplier[];
  items: Item[];
  itemPrices: ItemPrice[];
  orders: Order[];
  activeStatus: OrderStatus;
  activeSettingsTab: SettingsTab;
  orderIdCounters: Record<string, number>;
  settings: AppSettings;
  isLoading: boolean;
  isInitialized: boolean;
  syncStatus: SyncStatus;
  isManagerView: boolean;
  managerStoreFilter: StoreName | null;
  isEditModeEnabled: boolean;
}

export type Action =
  | { type: 'SET_ACTIVE_STORE'; payload: StoreName | 'Settings' }
  | { type: 'SET_ACTIVE_STATUS'; payload: OrderStatus }
  | { type: 'SET_ACTIVE_SETTINGS_TAB'; payload: SettingsTab }
  | { type: 'NAVIGATE_TO_SETTINGS'; payload: SettingsTab }
  | { type: '_ADD_ITEM'; payload: Item }
  | { type: '_UPDATE_ITEM'; payload: Item }
  | { type: '_DELETE_ITEM'; payload: string }
  | { type: '_ADD_SUPPLIER'; payload: Supplier }
  | { type: '_UPDATE_SUPPLIER'; payload: Supplier }
  | { type: '_UPDATE_STORE'; payload: Store }
  | { type: 'ADD_ORDERS'; payload: Order[] }
  | { type: 'UPDATE_ORDER'; payload: Order }
  | { type: 'DELETE_ORDER'; payload: string }
  | { type: 'SAVE_SETTINGS'; payload: Partial<AppState['settings']> }
  | { type: 'REPLACE_ITEM_DATABASE'; payload: { items: Item[], suppliers: Supplier[], rawCsv: string } }
  | { type: '_SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: '_MERGE_DATABASE'; payload: { items: Item[], suppliers: Supplier[], orders: Order[], stores: Store[], itemPrices: ItemPrice[] } }
  | { type: 'INITIALIZATION_COMPLETE' }
  | { type: 'SET_MANAGER_VIEW'; payload: { isManager: boolean; store: StoreName | null } }
  | { type: 'UPSERT_ITEM_PRICE'; payload: ItemPrice }
  | { type: 'SET_EDIT_MODE'; payload: boolean };

export interface AppContextActions {
    addItem: (item: Omit<Item, 'id'>) => Promise<Item>;
    updateItem: (item: Item) => Promise<void>;
    deleteItem: (itemId: string) => Promise<void>;
    addSupplier: (supplier: Omit<Supplier, 'id' | 'modifiedAt'>) => Promise<Supplier>;
    updateSupplier: (supplier: Supplier) => Promise<void>;
    updateStore: (store: Store) => Promise<void>;
    addOrder: (supplier: Supplier, store: StoreName, items?: OrderItem[], status?: OrderStatus) => Promise<void>;
    updateOrder: (order: Order) => Promise<void>;
    deleteOrder: (orderId: string) => Promise<void>;
    syncWithSupabase: (options?: { isInitialSync?: boolean }) => Promise<void>;
    addItemToDispatch: (item: Item) => Promise<void>;
    mergeOrders: (sourceOrderId: string, destinationOrderId: string) => Promise<void>;
    upsertItemPrice: (itemPrice: ItemPrice) => Promise<void>;
    mergeTodaysCompletedOrdersByPayment: (paymentMethod: PaymentMethod) => Promise<void>;
}


const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_ACTIVE_STORE':
      return { ...state, activeStore: action.payload, isEditModeEnabled: false }; // Disable edit mode on store change
    case 'SET_ACTIVE_STATUS':
      return { ...state, activeStatus: action.payload, isEditModeEnabled: false }; // Disable edit mode on status change
    case 'SET_ACTIVE_SETTINGS_TAB':
        return { ...state, activeSettingsTab: action.payload };
    case 'NAVIGATE_TO_SETTINGS':
        return { ...state, activeStore: 'Settings', activeSettingsTab: action.payload };
    case 'SET_EDIT_MODE':
        return { ...state, isEditModeEnabled: action.payload };
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
    case '_UPDATE_STORE':
        return { ...state, stores: state.stores.map(s => s.id === action.payload.id ? action.payload : s) };
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
        const { items: remoteItems, suppliers: remoteSuppliers, orders: remoteOrders, stores: remoteStores, itemPrices: remoteItemPrices } = action.payload;
        
        const mergedItemsMap = new Map(remoteItems.map(i => [i.id, i]));
        state.items.forEach(localItem => !mergedItemsMap.has(localItem.id) && mergedItemsMap.set(localItem.id, localItem));

        const mergedSuppliersMap = new Map(remoteSuppliers.map(s => [s.id, s]));
        state.suppliers.forEach(localSupplier => !mergedSuppliersMap.has(localSupplier.id) && mergedSuppliersMap.set(localSupplier.id, localSupplier));

        const mergedStoresMap = new Map(remoteStores.map(s => [s.id, s]));
        state.stores.forEach(localStore => !mergedStoresMap.has(localStore.id) && mergedStoresMap.set(localStore.id, localStore));

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

        const mergedItemPricesMap = new Map(remoteItemPrices.map(p => [p.id, p]));
        state.itemPrices.forEach(localPrice => !mergedItemPricesMap.has(localPrice.id) && mergedItemPricesMap.set(localPrice.id, localPrice));

        return { 
            ...state, 
            items: Array.from(mergedItemsMap.values()), 
            suppliers: Array.from(mergedSuppliersMap.values()), 
            stores: Array.from(mergedStoresMap.values()),
            orders: mergedOrders,
            itemPrices: Array.from(mergedItemPricesMap.values()),
        };
    }
    case 'INITIALIZATION_COMPLETE':
      return { ...state, isInitialized: true };
    case 'SET_MANAGER_VIEW':
        return {
            ...state,
            isManagerView: action.payload.isManager,
            managerStoreFilter: action.payload.store,
        };
    case 'UPSERT_ITEM_PRICE': {
        const newPrice = action.payload;
        const priceExists = state.itemPrices.some(p => p.id === newPrice.id);
        let newItemPrices;
        if (priceExists) {
            newItemPrices = state.itemPrices.map(p => p.id === newPrice.id ? newPrice : p);
        } else {
            newItemPrices = [...state.itemPrices, newPrice];
        }
        return { ...state, itemPrices: newItemPrices };
    }
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
      supabaseUrl: 'https://expwmqozywxbhewaczju.supabase.co',
      supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4cHdtcW96eXd4Ymhld2Fjemp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2Njc5MjksImV4cCI6MjA3NzI0MzkyOX0.Tf0g0yIZ3pd-OcNrmLEdozDt9eT7Fn0Mjlu8BHt1vyg',
      isAiEnabled: true,
      geminiApiKey: 'AIzaSyDN0Z_WM4PvhMhJ0nTPF9lM06lepFrZ-qM',
      telegramBotToken: '8347024604:AAHotssxpa41D53fMP10_8kIR6PCcVgw0i0',
      aiParsingRules: {
        global: {
          "Chicken": "Chicken breast",
          "Beef": "Beef (rump)",
          "Mushroom can": "Mushroom",
          "Cabbage": "Cabbage (white)",
        }
      },
      receiptTemplates: {},
    },
    isLoading: false,
    isInitialized: false,
    syncStatus: 'idle',
    isManagerView: false,
    managerStoreFilter: null,
    isEditModeEnabled: false,
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
  finalState.isEditModeEnabled = false; // Always start with edit mode off

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
      addSupplier: async () => { throw new Error('addSupplier not implemented'); },
      updateSupplier: async () => {}, updateStore: async () => {}, addOrder: async () => {},
      updateOrder: async () => {}, deleteOrder: async () => {},
      syncWithSupabase: async () => {},
      addItemToDispatch: async () => {},
      mergeOrders: async () => {},
      upsertItemPrice: async () => {},
      mergeTodaysCompletedOrdersByPayment: async () => {},
  }
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, getInitialState());
  const { notify } = useNotifier();
  
  useEffect(() => {
    try {
        const stateToSave = { ...state, isLoading: false, isInitialized: true };
        localStorage.setItem(APP_STATE_KEY, JSON.stringify(stateToSave));
    } catch(err) { console.error("Could not save state to localStorage", err); }
  }, [state]);

  const syncWithSupabase = useCallback(async (options?: { isInitialSync?: boolean }) => {
    dispatch({ type: '_SET_SYNC_STATUS', payload: 'syncing' });
    try {
        if (!navigator.onLine) {
            if (!options?.isInitialSync) notify('Offline. Using cached data.', 'info');
            return dispatch({ type: '_SET_SYNC_STATUS', payload: 'offline' });
        }
        const { supabaseUrl, supabaseKey } = state.settings;
        if (!options?.isInitialSync) notify('Syncing with database...', 'info');

        const { items, suppliers, stores, itemPrices } = await getItemsAndSuppliersFromSupabase({ url: supabaseUrl, key: supabaseKey });
        const orders = await getOrdersFromSupabase({ url: supabaseUrl, key: supabaseKey, suppliers });
        
        dispatch({ type: '_MERGE_DATABASE', payload: { items, suppliers, orders, stores, itemPrices } }); 
        
        if (!options?.isInitialSync) notify('Sync complete.', 'success');
        dispatch({ type: '_SET_SYNC_STATUS', payload: 'idle' });
    } catch (e: any) {
        if (!options?.isInitialSync) notify(`Sync failed: ${e.message}. Using cache.`, 'error');
        dispatch({ type: '_SET_SYNC_STATUS', payload: 'error' });
    }
  }, [state.settings, notify, dispatch]);

  useEffect(() => {
    if (!state.isInitialized) {
      dispatch({ type: 'INITIALIZATION_COMPLETE' });
      syncWithSupabase({ isInitialSync: true });
    }
  }, [state.isInitialized, syncWithSupabase]);

  const actions: AppContextActions = {
    addItem: async (item) => {
        const newItem = await supabaseAddItem({ item, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: '_ADD_ITEM', payload: newItem });
        notify(`Item "${newItem.name}" created.`, 'success');
        return newItem;
    },
    updateItem: async (item) => {
        const updatedItem = await supabaseUpdateItem({ item, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: '_UPDATE_ITEM', payload: updatedItem });
        notify(`Item "${updatedItem.name}" updated.`, 'success');
    },
    deleteItem: async (itemId) => {
        await supabaseDeleteItem({ itemId, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: '_DELETE_ITEM', payload: itemId });
        notify('Item deleted.', 'success');
    },
    addSupplier: async (supplier) => {
        const newSupplier = await supabaseAddSupplier({ supplier: supplier as Partial<Supplier> & { name: SupplierName }, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: '_ADD_SUPPLIER', payload: newSupplier });
        notify(`Supplier "${newSupplier.name}" created.`, 'success');
        return newSupplier;
    },
    updateSupplier: async (supplier) => {
        const updatedSupplier = await supabaseUpdateSupplier({ supplier, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: '_UPDATE_SUPPLIER', payload: updatedSupplier });
        notify(`Supplier "${updatedSupplier.name}" updated.`, 'success');
    },
    updateStore: async (store) => {
        const updatedStore = await supabaseUpdateStore({ store, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: '_UPDATE_STORE', payload: updatedStore });
        notify(`Store "${updatedStore.name}" updated.`, 'success');
    },
    addOrder: async (supplier, store, items = [], status = OrderStatus.DISPATCHING) => {
        let supplierToUse = supplier;
        if (supplier.id.startsWith('new_')) {
            notify(`Verifying supplier: ${supplier.name}...`, 'info');
            const newSupplierFromDb = await supabaseAddSupplier({ supplier: { name: supplier.name }, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
            dispatch({ type: '_ADD_SUPPLIER', payload: newSupplierFromDb });
            supplierToUse = newSupplierFromDb;
        }
        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}${ (now.getMonth() + 1).toString().padStart(2, '0')}`;
        const counterKey = `${dateStr}_${supplierToUse.name}_${store}`;
        const newCounter = (state.orderIdCounters[counterKey] || 0) + 1;
        const newOrderId = `${dateStr}_${supplierToUse.name}_${store}_${String(newCounter).padStart(3,'0')}`;
        const newOrder: Order = {
            id: `placeholder_${Date.now()}`, orderId: newOrderId, store, supplierId: supplierToUse.id, supplierName: supplierToUse.name, items, status,
            isSent: status !== OrderStatus.DISPATCHING, 
            isReceived: status === OrderStatus.COMPLETED, 
            createdAt: now.toISOString(), modifiedAt: now.toISOString(), 
            completedAt: status === OrderStatus.COMPLETED ? now.toISOString() : undefined,
            paymentMethod: supplierToUse.paymentMethod,
        };
        const savedOrder = await supabaseAddOrder({ order: newOrder, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: 'ADD_ORDERS', payload: [savedOrder] });
        notify(`Order for ${supplierToUse.name} created.`, 'success');
    },
    updateOrder: async (order) => {
        const updatedOrder = await supabaseUpdateOrder({ order, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: 'UPDATE_ORDER', payload: updatedOrder });
    },
    deleteOrder: async (orderId) => {
        await supabaseDeleteOrder({ orderId, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: 'DELETE_ORDER', payload: orderId });
        notify(`Order deleted.`, 'success');
    },
    addItemToDispatch: async (item) => {
        const { activeStore, orders, suppliers, itemPrices } = state;
        if (activeStore === 'Settings') {
            notify('Cannot add items to dispatch from this view.', 'info');
            return;
        }
        
        const masterPrice = itemPrices.find(p => p.itemId === item.id && p.supplierId === item.supplierId && p.isMaster)?.price;
        
        const existingOrder = orders.find(o => 
            o.store === activeStore && 
            o.supplierId === item.supplierId && 
            o.status === OrderStatus.DISPATCHING
        );
    
        if (existingOrder) {
            const itemInOrderIndex = existingOrder.items.findIndex(i => i.itemId === item.id);
            if (itemInOrderIndex > -1) {
                // Item exists, increment quantity
                const updatedItems = [...existingOrder.items];
                updatedItems[itemInOrderIndex] = {
                    ...updatedItems[itemInOrderIndex],
                    quantity: updatedItems[itemInOrderIndex].quantity + 1 // Assume adding 1
                };
                await actions.updateOrder({ ...existingOrder, items: updatedItems });
                notify(`Incremented "${item.name}" in existing order.`, 'success');
                return;
            }
            
            // Item does not exist in the order, so add it
            const newItem: OrderItem = { itemId: item.id, name: item.name, quantity: 1, unit: item.unit, price: masterPrice };
            const updatedItems = [...existingOrder.items, newItem];
            await actions.updateOrder({ ...existingOrder, items: updatedItems });
            notify(`Added "${item.name}" to existing order.`, 'success');
        } else {
            // No existing order for this supplier, so create a new one
            const supplier = suppliers.find(s => s.id === item.supplierId);
            if (!supplier) {
                notify(`Supplier for "${item.name}" not found.`, 'error');
                return;
            }
            const newOrderItem: OrderItem = { itemId: item.id, name: item.name, quantity: 1, unit: item.unit, price: masterPrice };
            await actions.addOrder(supplier, activeStore as StoreName, [newOrderItem]);
        }
    },
    mergeOrders: async (sourceOrderId: string, destinationOrderId: string) => {
        const sourceOrder = state.orders.find(o => o.id === sourceOrderId);
        const destinationOrder = state.orders.find(o => o.id === destinationOrderId);

        if (!sourceOrder || !destinationOrder) {
            notify("Could not find orders to merge.", "error");
            return;
        }

        const mergedItems = [...destinationOrder.items];
        sourceOrder.items.forEach(itemToMerge => {
            const existingItemIndex = mergedItems.findIndex(i => i.itemId === itemToMerge.itemId);
            if (existingItemIndex > -1) {
                mergedItems[existingItemIndex].quantity += itemToMerge.quantity;
            } else {
                mergedItems.push(itemToMerge);
            }
        });

        await actions.updateOrder({ ...destinationOrder, items: mergedItems });
        await actions.deleteOrder(sourceOrderId);
        notify(`Merged order into ${destinationOrder.supplierName}.`, "success");
    },
    upsertItemPrice: async (itemPrice) => {
        const savedPrice = await supabaseUpsertItemPrice({ itemPrice, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: 'UPSERT_ITEM_PRICE', payload: savedPrice });
    },
    mergeTodaysCompletedOrdersByPayment: async (paymentMethod: PaymentMethod) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const ordersToMerge = state.orders.filter(o => {
            if (o.status !== OrderStatus.COMPLETED || !o.completedAt) return false;
            const completedDate = new Date(o.completedAt);
            completedDate.setHours(0, 0, 0, 0);
            const orderPaymentMethod = o.paymentMethod || state.suppliers.find(s => s.id === o.supplierId)?.paymentMethod;
            return completedDate.getTime() === today.getTime() && orderPaymentMethod === paymentMethod;
        });

        if (ordersToMerge.length < 2) {
            notify(`Found ${ordersToMerge.length} order(s) for "${paymentMethod.toUpperCase()}". Need at least 2 to merge.`, 'info');
            return;
        }

        const destinationOrder = { ...ordersToMerge[0] };
        const sourceOrders = ordersToMerge.slice(1);
        
        const aggregatedItems = new Map<string, OrderItem>();
        destinationOrder.items.forEach(item => {
            const key = `${item.itemId}-${item.unit || 'none'}`;
            aggregatedItems.set(key, { ...item });
        });

        for (const sourceOrder of sourceOrders) {
            for (const itemToMerge of sourceOrder.items) {
                const key = `${itemToMerge.itemId}-${itemToMerge.unit || 'none'}`;
                const existingItem = aggregatedItems.get(key);
                if (existingItem) {
                    // Weighted average for price
                    if (existingItem.price !== undefined && itemToMerge.price !== undefined) {
                        const existingTotalValue = existingItem.price * existingItem.quantity;
                        const toMergeTotalValue = itemToMerge.price * itemToMerge.quantity;
                        const newTotalQuantity = existingItem.quantity + itemToMerge.quantity;
                        existingItem.price = (existingTotalValue + toMergeTotalValue) / newTotalQuantity;
                    }
                    existingItem.quantity += itemToMerge.quantity;
                } else {
                    aggregatedItems.set(key, { ...itemToMerge });
                }
            }
        }

        destinationOrder.items = Array.from(aggregatedItems.values());
        
        await actions.updateOrder(destinationOrder);

        for (const sourceOrder of sourceOrders) {
            await actions.deleteOrder(sourceOrder.id);
        }

        notify(`Merged ${ordersToMerge.length} orders into one for ${paymentMethod.toUpperCase()}.`, 'success');
    },
    syncWithSupabase,
  };

  for (const actionName in actions) {
      const originalAction = (actions as any)[actionName];
      (actions as any)[actionName] = async (...args: any[]) => {
          try {
              if (actionName === 'addItemToDispatch') {
                 // The 'addItemToDispatch' action calls other wrapped actions, so we call it directly
                 // to avoid double error handling.
                 return await originalAction(...args);
              }
              return await originalAction(...args);
          } catch (e: any) {
              notify(`Error: ${e.message}`, 'error');
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