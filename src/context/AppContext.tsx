import React, { createContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { AppState, Order, Item, Supplier, Store, AppSettings, OrderStatus, StoreName, Unit, SupplierName, OrderItem, ItemPrice, DueReportTopUp, QuickOrder, SyncStatus, SettingsTab } from '../types';
import * as supabaseService from '../services/supabaseService';
import { useNotifier } from './NotificationContext';
import { parseItemListLocally } from '../services/localParsingService';

// Initial State
const initialState: AppState = {
  stores: [],
  activeStore: 'ALL', // Default or persisted
  suppliers: [],
  items: [],
  itemPrices: [],
  orders: [],
  quickOrders: [],
  dueReportTopUps: [],
  notifications: [],
  activeStatus: OrderStatus.ON_THE_WAY,
  activeSettingsTab: 'items',
  orderIdCounters: {},
  settings: {
    supabaseUrl: localStorage.getItem('supabaseUrl') || '',
    supabaseKey: localStorage.getItem('supabaseKey') || '',
    isAiEnabled: false,
  },
  isLoading: true,
  isInitialized: false,
  syncStatus: 'idle',
  isManagerView: false,
  isSmartView: true,
  managerStoreFilter: null,
  isDualPaneMode: false,
  cardWidth: null,
  draggedOrderId: null,
  draggedItem: null,
  columnCount: 3,
  initialAction: null,
  kaliTodoState: { sections: [] }
};

// Actions Definition
type Action =
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: 'SET_DATA'; payload: { items: Item[], suppliers: Supplier[], stores: Store[], itemPrices: ItemPrice[], dueReportTopUps: DueReportTopUp[], quickOrders: QuickOrder[] } }
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'ADD_ORDER'; payload: Order }
  | { type: 'UPDATE_ORDER'; payload: Order }
  | { type: 'DELETE_ORDER'; payload: string }
  | { type: 'SET_ACTIVE_STORE'; payload: StoreName | 'Settings' | 'ALL' }
  | { type: 'SET_ACTIVE_STATUS'; payload: OrderStatus }
  | { type: 'SET_ACTIVE_SETTINGS_TAB'; payload: SettingsTab }
  | { type: 'SAVE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_MANAGER_VIEW'; payload: { isManager: boolean; store: StoreName | null } }
  | { type: 'SET_SMART_VIEW'; payload: boolean }
  | { type: 'SET_DRAGGED_ORDER_ID'; payload: string | null }
  | { type: 'SET_DRAGGED_ITEM'; payload: { item: OrderItem; sourceOrderId: string } | null }
  | { type: 'SET_INITIAL_ACTION'; payload: string }
  | { type: 'CLEAR_INITIAL_ACTION' }
  | { type: 'SYNC_KALI_TODO' }
  | { type: 'TICK_KALI_TODO_ITEM'; payload: { uniqueId: string } }
  | { type: 'ADD_KALI_TODO_SECTION'; payload: { title: string } }
  | { type: 'MOVE_KALI_TODO_ITEM'; payload: { item: any; destinationSectionId: string } }
  | { type: 'NAVIGATE_TO_SETTINGS'; payload: SettingsTab }
  // Optimistic updates for other entities
  | { type: 'ADD_ITEM'; payload: Item }
  | { type: 'UPDATE_ITEM'; payload: Item }
  | { type: 'DELETE_ITEM'; payload: string }
  | { type: 'ADD_SUPPLIER'; payload: Supplier }
  | { type: 'UPDATE_SUPPLIER'; payload: Supplier }
  | { type: 'DELETE_SUPPLIER'; payload: string }
  | { type: 'UPDATE_STORE'; payload: Store }
  | { type: 'UPSERT_ITEM_PRICE'; payload: ItemPrice }
  | { type: 'UPSERT_DUE_REPORT_TOP_UP'; payload: DueReportTopUp }
  | { type: 'ADD_QUICK_ORDER'; payload: QuickOrder }
  | { type: 'DELETE_QUICK_ORDER'; payload: string };


const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_INITIALIZED': return { ...state, isInitialized: action.payload };
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_SYNC_STATUS': return { ...state, syncStatus: action.payload };
    case 'SET_DATA': return { ...state, ...action.payload };
    case 'SET_ORDERS': return { ...state, orders: action.payload };
    case 'ADD_ORDER': return { ...state, orders: [action.payload, ...state.orders] };
    case 'UPDATE_ORDER': return { ...state, orders: state.orders.map(o => o.id === action.payload.id ? action.payload : o) };
    case 'DELETE_ORDER': return { ...state, orders: state.orders.filter(o => o.id !== action.payload) };
    case 'SET_ACTIVE_STORE': return { ...state, activeStore: action.payload };
    case 'SET_ACTIVE_STATUS': return { ...state, activeStatus: action.payload };
    case 'SET_ACTIVE_SETTINGS_TAB': return { ...state, activeSettingsTab: action.payload, activeStore: 'Settings' };
    case 'NAVIGATE_TO_SETTINGS': return { ...state, activeSettingsTab: action.payload, activeStore: 'Settings' };
    case 'SAVE_SETTINGS': {
        const newSettings = { ...state.settings, ...action.payload };
        localStorage.setItem('supabaseUrl', newSettings.supabaseUrl);
        localStorage.setItem('supabaseKey', newSettings.supabaseKey);
        return { ...state, settings: newSettings };
    }
    case 'SET_MANAGER_VIEW': return { ...state, isManagerView: action.payload.isManager, managerStoreFilter: action.payload.store };
    case 'SET_SMART_VIEW': return { ...state, isSmartView: action.payload };
    case 'SET_DRAGGED_ORDER_ID': return { ...state, draggedOrderId: action.payload };
    case 'SET_DRAGGED_ITEM': return { ...state, draggedItem: action.payload };
    case 'SET_INITIAL_ACTION': return { ...state, initialAction: action.payload };
    case 'CLEAR_INITIAL_ACTION': return { ...state, initialAction: null };
    
    // CRUD Item
    case 'ADD_ITEM': return { ...state, items: [...state.items, action.payload] };
    case 'UPDATE_ITEM': return { ...state, items: state.items.map(i => i.id === action.payload.id ? action.payload : i) };
    case 'DELETE_ITEM': return { ...state, items: state.items.filter(i => i.id !== action.payload) };

    // CRUD Supplier
    case 'ADD_SUPPLIER': return { ...state, suppliers: [...state.suppliers, action.payload] };
    case 'UPDATE_SUPPLIER': return { ...state, suppliers: state.suppliers.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_SUPPLIER': return { ...state, suppliers: state.suppliers.filter(s => s.id !== action.payload) };

    // CRUD Store
    case 'UPDATE_STORE': return { ...state, stores: state.stores.map(s => s.id === action.payload.id ? action.payload : s) };

    // CRUD Price
    case 'UPSERT_ITEM_PRICE': {
        const existingIndex = state.itemPrices.findIndex(p => p.itemId === action.payload.itemId && p.supplierId === action.payload.supplierId && p.unit === action.payload.unit);
        if (existingIndex > -1) {
            const newPrices = [...state.itemPrices];
            newPrices[existingIndex] = action.payload;
            return { ...state, itemPrices: newPrices };
        }
        return { ...state, itemPrices: [...state.itemPrices, action.payload] };
    }

    // CRUD TopUp
    case 'UPSERT_DUE_REPORT_TOP_UP': {
        const existingIndex = state.dueReportTopUps.findIndex(t => t.date === action.payload.date);
        if (existingIndex > -1) {
            const newTopUps = [...state.dueReportTopUps];
            newTopUps[existingIndex] = action.payload;
            return { ...state, dueReportTopUps: newTopUps };
        }
        return { ...state, dueReportTopUps: [...state.dueReportTopUps, action.payload] };
    }
    
    // CRUD Quick Order
    case 'ADD_QUICK_ORDER': return { ...state, quickOrders: [...state.quickOrders, action.payload] };
    case 'DELETE_QUICK_ORDER': return { ...state, quickOrders: state.quickOrders.filter(q => q.id !== action.payload) };

    case 'SYNC_KALI_TODO': 
      // Simplistic placeholder implementation for KALI TODO sync based on orders
      // In a real app, this would likely be more complex or involve a separate table.
      // For now, we just keep existing sections if any.
      return state;

    default: return state;
  }
};

export interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  actions: {
    syncWithSupabase: () => Promise<void>;
    addOrder: (supplier: Supplier, store: StoreName, items: OrderItem[], status?: OrderStatus) => Promise<Order>;
    updateOrder: (order: Order) => Promise<void>;
    deleteOrder: (orderId: string) => Promise<void>;
    mergeOrders: (sourceId: string, destId: string) => Promise<void>;
    addItem: (item: Omit<Item, 'id'>) => Promise<Item>;
    updateItem: (item: Item) => Promise<Item>;
    deleteItem: (itemId: string) => Promise<void>;
    addSupplier: (supplier: Partial<Supplier> & { name: SupplierName }) => Promise<Supplier>;
    updateSupplier: (supplier: Supplier) => Promise<Supplier>;
    deleteSupplier: (supplierId: string) => Promise<void>;
    updateStore: (store: Store) => Promise<void>;
    upsertItemPrice: (itemPrice: Omit<ItemPrice, 'id' | 'createdAt'>) => Promise<void>;
    upsertDueReportTopUp: (topUp: DueReportTopUp) => Promise<void>;
    addQuickOrder: (quickOrder: Omit<QuickOrder, 'id'>) => Promise<void>;
    deleteQuickOrder: (id: string) => Promise<void>;
    pasteItemsForStore: (text: string, store: StoreName) => Promise<void>;
    deleteItemFromOrder: (item: OrderItem, orderId: string) => Promise<void>;
  };
}

// Create Context
export const AppContext = createContext<AppContextType>({} as AppContextType);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { notify } = useNotifier();

  const { supabaseUrl, supabaseKey } = state.settings;
  const credentials = { url: supabaseUrl, key: supabaseKey };
  const isConfigured = !!supabaseUrl && !!supabaseKey;

  const syncWithSupabase = useCallback(async () => {
    if (!isConfigured) return;
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
    try {
      const data = await supabaseService.getItemsAndSuppliersFromSupabase(credentials);
      dispatch({ type: 'SET_DATA', payload: data });
      
      const orders = await supabaseService.getOrdersFromSupabase({ ...credentials, suppliers: data.suppliers });
      dispatch({ type: 'SET_ORDERS', payload: orders });
      
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
      dispatch({ type: 'SET_INITIALIZED', payload: true });
    } catch (error: any) {
      console.error("Sync failed:", error);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      notify(`Sync failed: ${error.message}`, 'error');
    }
  }, [isConfigured, supabaseUrl, supabaseKey, notify]);

  useEffect(() => {
      if (isConfigured) {
          syncWithSupabase();
      } else {
          dispatch({ type: 'SET_INITIALIZED', payload: true });
      }
  }, [isConfigured]);

  // Actions wrapper
  const actions = {
    syncWithSupabase,
    addOrder: async (supplier: Supplier, store: StoreName, items: OrderItem[], status: OrderStatus = OrderStatus.DISPATCHING) => {
        const newOrder: Order = {
            id: '', // Temp ID, will be replaced by DB
            orderId: `${Math.floor(Math.random() * 10000)}`, // Temp ID
            store,
            supplierId: supplier.id,
            supplierName: supplier.name,
            items,
            status,
            isSent: false,
            isReceived: false,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
        };
        try {
             const createdOrder = await supabaseService.addOrder({ order: newOrder, ...credentials });
             dispatch({ type: 'ADD_ORDER', payload: createdOrder });
             return createdOrder;
        } catch (error: any) {
            notify(`Failed to add order: ${error.message}`, 'error');
            throw error;
        }
    },
    updateOrder: async (order: Order) => {
        dispatch({ type: 'UPDATE_ORDER', payload: order }); // Optimistic
        try {
            await supabaseService.updateOrder({ order, ...credentials });
        } catch (error: any) {
             notify(`Failed to update order: ${error.message}`, 'error');
             syncWithSupabase(); // Revert/Refresh
        }
    },
    deleteOrder: async (orderId: string) => {
        dispatch({ type: 'DELETE_ORDER', payload: orderId }); // Optimistic
        try {
            await supabaseService.deleteOrder({ orderId, ...credentials });
        } catch (error: any) {
            notify(`Failed to delete order: ${error.message}`, 'error');
            syncWithSupabase();
        }
    },
    mergeOrders: async (sourceId: string, destId: string) => {
        const sourceOrder = state.orders.find(o => o.id === sourceId);
        const destOrder = state.orders.find(o => o.id === destId);
        if (!sourceOrder || !destOrder) return;

        const mergedItems = [...destOrder.items];
        sourceOrder.items.forEach(srcItem => {
            const existing = mergedItems.find(i => i.itemId === srcItem.itemId && i.isSpoiled === srcItem.isSpoiled);
            if (existing) {
                existing.quantity += srcItem.quantity;
            } else {
                mergedItems.push(srcItem);
            }
        });
        
        // Update destination
        await actions.updateOrder({ ...destOrder, items: mergedItems });
        // Delete source
        await actions.deleteOrder(sourceId);
        notify('Orders merged.', 'success');
    },
    addItem: async (item: Omit<Item, 'id'>) => {
        try {
            const newItem = await supabaseService.addItem({ item, ...credentials });
            dispatch({ type: 'ADD_ITEM', payload: newItem });
            return newItem;
        } catch (error: any) {
             notify(`Failed to add item: ${error.message}`, 'error');
             throw error;
        }
    },
    updateItem: async (item: Item) => {
         dispatch({ type: 'UPDATE_ITEM', payload: item });
         try {
             const updated = await supabaseService.updateItem({ item, ...credentials });
             dispatch({ type: 'UPDATE_ITEM', payload: updated });
             return updated;
         } catch (error: any) {
             notify(`Failed to update item: ${error.message}`, 'error');
             syncWithSupabase();
             throw error;
         }
    },
    deleteItem: async (itemId: string) => {
        dispatch({ type: 'DELETE_ITEM', payload: itemId });
        try {
            await supabaseService.deleteItem({ itemId, ...credentials });
        } catch (error: any) {
            notify(`Failed to delete item: ${error.message}`, 'error');
            syncWithSupabase();
        }
    },
    addSupplier: async (supplier: Partial<Supplier> & { name: SupplierName }) => {
        try {
            const newSupplier = await supabaseService.addSupplier({ supplier, ...credentials });
            // Check if it exists
            const exists = state.suppliers.find(s => s.id === newSupplier.id);
            if (!exists) {
                 dispatch({ type: 'ADD_SUPPLIER', payload: newSupplier });
            }
            return newSupplier;
        } catch (error: any) {
            notify(`Failed to add supplier: ${error.message}`, 'error');
            throw error;
        }
    },
    updateSupplier: async (supplier: Supplier) => {
        dispatch({ type: 'UPDATE_SUPPLIER', payload: supplier });
        try {
            const updated = await supabaseService.updateSupplier({ supplier, ...credentials });
            dispatch({ type: 'UPDATE_SUPPLIER', payload: updated });
            return updated;
        } catch (error: any) {
             notify(`Failed to update supplier: ${error.message}`, 'error');
             syncWithSupabase();
             throw error;
        }
    },
    deleteSupplier: async (supplierId: string) => {
        dispatch({ type: 'DELETE_SUPPLIER', payload: supplierId });
        try {
            await supabaseService.deleteSupplier({ supplierId, ...credentials });
        } catch (error: any) {
            notify(`Failed to delete supplier: ${error.message}`, 'error');
            syncWithSupabase();
        }
    },
    updateStore: async (store: Store) => {
        dispatch({ type: 'UPDATE_STORE', payload: store });
        try {
            await supabaseService.updateStore({ store, ...credentials });
        } catch (error: any) {
            notify(`Failed to update store: ${error.message}`, 'error');
            syncWithSupabase();
        }
    },
    upsertItemPrice: async (itemPrice: Omit<ItemPrice, 'id' | 'createdAt'>) => {
        try {
             const savedPrice = await supabaseService.supabaseUpsertItemPrice({ itemPrice, ...credentials });
             dispatch({ type: 'UPSERT_ITEM_PRICE', payload: savedPrice });
        } catch (error: any) {
            notify(`Failed to save price: ${error.message}`, 'error');
        }
    },
    upsertDueReportTopUp: async (topUp: DueReportTopUp) => {
        dispatch({ type: 'UPSERT_DUE_REPORT_TOP_UP', payload: topUp });
        try {
            await supabaseService.upsertDueReportTopUp({ topUp, ...credentials });
        } catch (error: any) {
             notify(`Failed to save top up: ${error.message}`, 'error');
        }
    },
    addQuickOrder: async (quickOrder: Omit<QuickOrder, 'id'>) => {
        try {
            const saved = await supabaseService.addQuickOrder({ quickOrder, ...credentials });
            dispatch({ type: 'ADD_QUICK_ORDER', payload: saved });
        } catch (error: any) {
            notify(`Failed to save quick order: ${error.message}`, 'error');
        }
    },
    deleteQuickOrder: async (id: string) => {
        dispatch({ type: 'DELETE_QUICK_ORDER', payload: id });
        try {
            await supabaseService.deleteQuickOrder({ id, ...credentials });
        } catch (error: any) {
             notify(`Failed to delete quick order: ${error.message}`, 'error');
             syncWithSupabase();
        }
    },
    pasteItemsForStore: async (text: string, store: StoreName) => {
        try {
            const parsedItems = await parseItemListLocally(text, state.items);
             const ordersBySupplier: Record<string, { supplier: Supplier, items: OrderItem[] }> = {};

            for (const pItem of parsedItems) {
                let supplier: Supplier | null = null;
                let orderItem: OrderItem | null = null;

                if (pItem.matchedItemId) {
                    const existingItem = state.items.find(i => i.id === pItem.matchedItemId);
                    if (existingItem) {
                        supplier = state.suppliers.find(s => s.id === existingItem.supplierId) || null;
                        orderItem = { itemId: existingItem.id, name: existingItem.name, quantity: pItem.quantity, unit: existingItem.unit };
                    }
                }
                
                if (supplier && orderItem) {
                    if (!ordersBySupplier[supplier.id]) {
                        ordersBySupplier[supplier.id] = { supplier, items: [] };
                    }
                    ordersBySupplier[supplier.id].items.push(orderItem);
                }
            }

             for (const { supplier, items } of Object.values(ordersBySupplier)) {
                 const existingOrder = state.orders.find(o => o.store === store && o.supplierId === supplier.id && o.status === OrderStatus.DISPATCHING);
                 if (existingOrder) {
                      const updatedItems = [...existingOrder.items];
                      items.forEach(itemToAdd => {
                          const existingItemIndex = updatedItems.findIndex(i => i.itemId === itemToAdd.itemId);
                          if (existingItemIndex !== -1) {
                              updatedItems[existingItemIndex].quantity += itemToAdd.quantity;
                          } else {
                              updatedItems.push(itemToAdd);
                          }
                      });
                      await actions.updateOrder({ ...existingOrder, items: updatedItems });
                 } else {
                      await actions.addOrder(supplier, store, items);
                 }
             }
             notify('Items pasted successfully via share.', 'success');
        } catch (e: any) {
            notify('Failed to process shared text.', 'error');
        }
    },
    deleteItemFromOrder: async (item: OrderItem, orderId: string) => {
        const order = state.orders.find(o => o.id === orderId);
        if (!order) return;
        const newItems = order.items.filter(i => !(i.itemId === item.itemId && i.isSpoiled === item.isSpoiled));
        await actions.updateOrder({ ...order, items: newItems });
    }
  };

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
};