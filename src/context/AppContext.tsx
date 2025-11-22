import React, { createContext, useReducer, ReactNode, Dispatch, useEffect, useCallback } from 'react';
import { Item, Order, OrderItem, OrderStatus, Store, StoreName, Supplier, SupplierName, Unit, ItemPrice, PaymentMethod, AppSettings, SyncStatus, SettingsTab, DueReportTopUp, Notification, QuickOrder } from '../types';
import { getItemsAndSuppliersFromSupabase, getOrdersFromSupabase, addOrder as supabaseAddOrder, updateOrder as supabaseUpdateOrder, deleteOrder as supabaseDeleteOrder, addItem as supabaseAddItem, updateItem as supabaseUpdateItem, deleteItem as supabaseDeleteItem, updateSupplier as supabaseUpdateSupplier, addSupplier as supabaseAddSupplier, updateStore as supabaseUpdateStore, supabaseUpsertItemPrice, getAcknowledgedOrderUpdates, deleteSupplier as supabaseDeleteSupplier, upsertDueReportTopUp as supabaseUpsertDueReportTopUp, addQuickOrder as supabaseAddQuickOrder, deleteQuickOrder as supabaseDeleteQuickOrder } from '../services/supabaseService';
import { useNotifier, useNotificationDispatch } from './NotificationContext';
import { sendReminderToSupplier, sendCustomMessageToSupplier } from '../services/telegramService';
import { parseItemListLocally } from '../services/localParsingService';
import parseItemListWithGemini from '../services/geminiService';

// Safely access environment variables. 
// We use direct property access so build tools like Vite can statically replace them.
// We wrap in try-catch to handle environments where import.meta.env might be undefined.
const getSafeGeminiApiKey = () => {
    try {
        // @ts-ignore
        return import.meta.env?.VITE_GEMINI_API_KEY || '';
    } catch {
        return '';
    }
};

const getSafeTelegramBotToken = () => {
    try {
        // @ts-ignore
        const envToken = import.meta.env?.VITE_TELEGRAM_BOT_TOKEN;
        // Fallback to the provided token if env var is missing
        return envToken || '8347024604:AAFyAKVNeW_tPbpU79W9UsLtP4FRDInh7Og';
    } catch {
        return '8347024604:AAFyAKVNeW_tPbpU79W9UsLtP4FRDInh7Og';
    }
};

// Client-side safety net to ensure units are always valid for the database enum.
const normalizeUnit = (unit?: string): Unit | undefined => {
    if (!unit) return undefined;
    const u = unit.toLowerCase().trim();
    switch (u) {
        case 'pcs': case 'piece': case 'pieces': return Unit.PC;
        case 'kgs': case 'kilo': case 'kilos': case 'kilogram': return Unit.KG;
        case 'litter': case 'liters': case 'litres': return Unit.L;
        case 'rolls': return Unit.ROLL; case 'blocks': return Unit.BLOCK; case 'boxes': case 'bx': return Unit.BOX;
        case 'pax': case 'packs': return Unit.PK; case 'btl': case 'btls': case 'bottle': case 'bottles': return Unit.BT;
        case 'cans': return Unit.CAN; case 'glasses': return Unit.GLASS;
        default: if (Object.values(Unit).includes(u as Unit)) return u as Unit; return undefined;
    }
};

export interface AppState {
  stores: Store[];
  activeStore: StoreName | 'Settings' | 'ALL';
  suppliers: Supplier[];
  items: Item[];
  itemPrices: ItemPrice[];
  orders: Order[];
  quickOrders: QuickOrder[];
  dueReportTopUps: DueReportTopUp[];
  notifications: Notification[];
  activeStatus: OrderStatus;
  activeSettingsTab: SettingsTab;
  orderIdCounters: Record<string, number>;
  settings: AppSettings;
  isLoading: boolean;
  isInitialized: boolean;
  syncStatus: SyncStatus;
  isDualPaneMode: boolean;
  cardWidth: number | null;
  draggedOrderId: string | null;
  draggedItem: { item: OrderItem; sourceOrderId: string } | null;
  columnCount: 1 | 2 | 3;
  initialAction: string | null;
}

export type Action =
  | { type: 'SET_ACTIVE_STORE'; payload: StoreName | 'Settings' | 'ALL' }
  | { type: 'SET_ACTIVE_STATUS'; payload: OrderStatus }
  | { type: 'SET_ACTIVE_SETTINGS_TAB'; payload: SettingsTab }
  | { type: 'NAVIGATE_TO_SETTINGS'; payload: SettingsTab }
  | { type: '_ADD_ITEM'; payload: Item }
  | { type: '_UPDATE_ITEM'; payload: Item }
  | { type: '_DELETE_ITEM'; payload: string }
  | { type: '_ADD_SUPPLIER'; payload: Supplier }
  | { type: '_UPDATE_SUPPLIER'; payload: Supplier }
  | { type: '_DELETE_SUPPLIER'; payload: string }
  | { type: '_UPDATE_STORE'; payload: Store }
  | { type: 'ADD_ORDERS'; payload: Order[] }
  | { type: 'UPDATE_ORDER'; payload: Order }
  | { type: 'DELETE_ORDER'; payload: string }
  | { type: 'SAVE_SETTINGS'; payload: Partial<AppState['settings']> }
  | { type: 'REPLACE_ITEM_DATABASE'; payload: { items: Item[], suppliers: Supplier[], rawCsv: string } }
  | { type: '_SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: '_MERGE_DATABASE'; payload: { items: Item[], suppliers: Supplier[], orders: Order[], stores: Store[], itemPrices: ItemPrice[], dueReportTopUps: DueReportTopUp[], quickOrders: QuickOrder[] } }
  | { type: 'INITIALIZATION_COMPLETE' }
  | { type: 'UPSERT_ITEM_PRICE'; payload: ItemPrice }
  | { type: 'TOGGLE_DUAL_PANE_MODE' }
  | { type: 'CYCLE_COLUMN_COUNT' }
  | { type: 'SET_COLUMN_COUNT'; payload: 1 | 2 | 3 }
  | { type: 'SET_DRAGGED_ORDER_ID'; payload: string | null }
  | { type: 'SET_DRAGGED_ITEM'; payload: { item: OrderItem; sourceOrderId: string } | null }
  | { type: 'SET_CARD_WIDTH'; payload: number | null }
  | { type: 'UPSERT_DUE_REPORT_TOP_UP'; payload: DueReportTopUp }
  | { type: 'SET_INITIAL_ACTION'; payload: string | null }
  | { type: 'CLEAR_INITIAL_ACTION' }
  | { type: '_BATCH_UPDATE_ITEMS_STOCK'; payload: { itemId: string; stockQuantity: number }[] }
  | { type: 'ADD_QUICK_ORDER'; payload: QuickOrder }
  | { type: 'DELETE_QUICK_ORDER'; payload: string };


export interface AppContextActions {
    addItem: (item: Omit<Item, 'id'>) => Promise<Item>;
    updateItem: (item: Item) => Promise<void>;
    deleteItem: (itemId: string) => Promise<void>;
    addSupplier: (supplier: Omit<Supplier, 'id' | 'modifiedAt'>) => Promise<Supplier>;
    updateSupplier: (supplier: Supplier) => Promise<void>;
    deleteSupplier: (supplierId: string) => Promise<void>;
    updateStore: (store: Store) => Promise<void>;
    addOrder: (supplier: Supplier, store: StoreName, items?: OrderItem[], status?: OrderStatus) => Promise<Order>;
    updateOrder: (order: Order) => Promise<void>;
    deleteOrder: (orderId: string) => Promise<void>;
    deleteItemFromOrder: (item: OrderItem, sourceOrderId: string) => Promise<void>;
    syncWithSupabase: (options?: { isInitialSync?: boolean }) => Promise<void>;
    addItemToDispatch: (item: Item) => Promise<void>;
    mergeOrders: (sourceOrderId: string, destinationOrderId: string) => Promise<void>;
    upsertItemPrice: (itemPrice: Omit<ItemPrice, 'id' | 'createdAt'>) => Promise<void>;
    upsertDueReportTopUp: (topUp: DueReportTopUp) => Promise<void>;
    sendEtaRequest: (order: Order) => Promise<void>;
    pasteItemsForStore: (text: string, store: StoreName) => Promise<void>;
    addQuickOrder: (quickOrder: Omit<QuickOrder, 'id'>) => Promise<void>;
    deleteQuickOrder: (id: string) => Promise<void>;
}


const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_ACTIVE_STORE':
      return { ...state, activeStore: action.payload };
    case 'SET_ACTIVE_STATUS':
      return { ...state, activeStatus: action.payload };
    case 'SET_ACTIVE_SETTINGS_TAB':
        return { ...state, activeSettingsTab: action.payload };
    case 'NAVIGATE_TO_SETTINGS':
        return { 
            ...state, 
            activeStore: 'Settings', 
            activeSettingsTab: action.payload 
        };
    case 'TOGGLE_DUAL_PANE_MODE':
        return { ...state, isDualPaneMode: !state.isDualPaneMode };
    case 'SET_CARD_WIDTH':
        return { ...state, cardWidth: action.payload };
    case 'CYCLE_COLUMN_COUNT':
        return {
            ...state,
            columnCount: (state.columnCount === 1 ? 3 : 1) as 1 | 3,
        };
    case 'SET_COLUMN_COUNT':
        if (state.columnCount === action.payload) return state;
        return { ...state, columnCount: action.payload };
    case 'SET_DRAGGED_ORDER_ID':
        return { ...state, draggedOrderId: action.payload };
    case 'SET_DRAGGED_ITEM':
        return { ...state, draggedItem: action.payload };
    case 'SET_INITIAL_ACTION':
        return { ...state, initialAction: action.payload };
    case 'CLEAR_INITIAL_ACTION':
        return { ...state, initialAction: null };
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
    case '_DELETE_SUPPLIER':
        return { ...state, suppliers: state.suppliers.filter(s => s.id !== action.payload) };
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
        const { items: remoteItems, suppliers: remoteSuppliers, orders: remoteOrders, stores: remoteStores, itemPrices: remoteItemPrices, dueReportTopUps: remoteTopUps, quickOrders: remoteQuickOrders } = action.payload;
        
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
        
        const mergedQuickOrders = remoteQuickOrders || [];

        return { 
            ...state, 
            items: Array.from(mergedItemsMap.values()), 
            suppliers: Array.from(mergedSuppliersMap.values()), 
            stores: Array.from(mergedStoresMap.values()),
            orders: mergedOrders,
            itemPrices: Array.from(mergedItemPricesMap.values()),
            dueReportTopUps: remoteTopUps,
            quickOrders: mergedQuickOrders,
        };
    }
    case 'INITIALIZATION_COMPLETE':
      return { ...state, isInitialized: true };
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
    case 'UPSERT_DUE_REPORT_TOP_UP': {
        const newTopUp = action.payload;
        const existingIndex = state.dueReportTopUps.findIndex(t => t.date === newTopUp.date);
        let newTopUps;
        if (existingIndex > -1) {
            newTopUps = [...state.dueReportTopUps];
            newTopUps[existingIndex] = newTopUp;
        } else {
            newTopUps = [...state.dueReportTopUps, newTopUp];
        }
        return { ...state, dueReportTopUps: newTopUps };
    }
    case '_BATCH_UPDATE_ITEMS_STOCK': {
        const updates = new Map(action.payload.map(u => [u.itemId, u.stockQuantity]));
        return {
            ...state,
            items: state.items.map(item => 
                updates.has(item.id) 
                ? { ...item, stockQuantity: updates.get(item.id) } 
                : item
            )
        };
    }
    case 'ADD_QUICK_ORDER':
        return { ...state, quickOrders: [...state.quickOrders, action.payload] };
    case 'DELETE_QUICK_ORDER':
        return { ...state, quickOrders: state.quickOrders.filter(q => q.id !== action.payload) };
    default:
      return state;
  }
};

const APP_STATE_KEY = 'supplyChainCommanderState_v3';

const getInitialColumnCount = (): 1 | 2 | 3 => {
    const width = window.innerWidth;
    if (width < 768) {
        // Phone: always 1 column
        return 1;
    }
    // Tablet and larger are always 3
    return 3;
};


const getInitialState = (): AppState => {
  let loadedState: Partial<AppState> = {};
  try {
    const serializedState = localStorage.getItem(APP_STATE_KEY);
    if (serializedState) loadedState = JSON.parse(serializedState);
  } catch (err) { console.warn("Could not load state from localStorage", err); }

  const envGemini = getSafeGeminiApiKey();
  const envTelegram = getSafeTelegramBotToken();

  const initialState: AppState = {
    stores: [],
    activeStore: 'ALL',
    suppliers: [],
    items: [],
    itemPrices: [],
    orders: [],
    quickOrders: [],
    notifications: [],
    dueReportTopUps: [],
    activeStatus: OrderStatus.DISPATCHING,
    activeSettingsTab: 'items',
    orderIdCounters: {},
    settings: {
      supabaseUrl: 'https://expwmqozywxbhewaczju.supabase.co',
      supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4cHdtcW96eXd4Ymhld2Fjemp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2Njc5MjksImV4cCI6MjA3NzI0MzkyOX0.Tf0g0yIZ3pd-OcNrmLEdozDt9eT7Fn0Mjlu8BHt1vyg',
      isAiEnabled: true,
      geminiApiKey: envGemini,
      telegramBotToken: envTelegram,
      aiParsingRules: {
        global: {
          "Chicken": "Chicken breast",
          "Beef": "Beef (rump)",
          "Mushroom can": "Mushroom",
          "Cabbage": "Cabbage (white)",
          "chocolate syrup": "chocolate topping",
          "pizza flour": "flour (25kg)",
          "mushroom": "Mushroom fresh",
          "mushrooms": "Mushroom fresh",
          "mushrooms white": "Mushroom fresh",
          "french fries": "French fries (crinkle cut - GUD)",
        },
        [StoreName.SHANTI]: {
            "french fries": "french fries (straight cut - NOWACO)"
        }
      },
      receiptTemplates: {},
      messageTemplates: {
        defaultOrder: '<b>#️⃣ Order {{orderId}}</b>\n🚚 Delivery order\n📌 <b>{{storeName}}</b>\n\n{{items}}',
        kaliOrder: '<b>{{storeName}}</b>\n{{items}}',
        telegramReceipt: '🧾 <b>Receipt for Order <code>{{orderId}}</code></b>\n<b>Store:</b> {{store}}\n<b>Supplier:</b> {{supplierName}}\n<b>Date:</b> {{date}}\n\n{{items}}\n---------------------\n<b>Grand Total: {{grandTotal}}</b>'
      },
    },
    isLoading: false,
    isInitialized: false,
    syncStatus: 'idle',
    isDualPaneMode: false,
    draggedOrderId: null,
    draggedItem: null,
    cardWidth: null,
    columnCount: 3,
    initialAction: null,
  };

  const finalState = { ...initialState, ...loadedState };
  // Prioritize initial settings for critical infrastructure if missing, but respect user overrides if present
  finalState.settings = { ...initialState.settings, ...loadedState.settings };
  
  // Ensure keys are set if environment variables exist and state is empty
  if (!finalState.settings.geminiApiKey && envGemini) {
      finalState.settings.geminiApiKey = envGemini;
  }
  if (!finalState.settings.telegramBotToken && envTelegram) {
      finalState.settings.telegramBotToken = envTelegram;
  }
  
  if ((finalState as any).quickOrders === undefined) finalState.quickOrders = [];
  
  // Remove legacy properties
  if ((finalState as any).dueReportTopUps) delete (finalState as any).dueReportTopUps;
  if ((finalState as any).notifications) delete (finalState as any).notifications;
  if ((finalState as any).managerStoreFilter) delete (finalState as any).managerStoreFilter;
  if ((finalState as any).kaliTodoState) delete (finalState as any).kaliTodoState;
  if ((finalState as any).isSmartView) delete (finalState as any).isSmartView;

  finalState.orders = (loadedState.orders || []).map((o: Partial<Order>) => ({
      ...o,
      createdAt: o.createdAt || new Date(0).toISOString(),
      modifiedAt: o.modifiedAt || new Date().toISOString(),
  })) as Order[];
  finalState.isLoading = false;
  finalState.isInitialized = false;
  finalState.cardWidth = loadedState.cardWidth ?? null;
  finalState.columnCount = loadedState.columnCount ?? getInitialColumnCount();

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
      updateSupplier: async () => {}, deleteSupplier: async () => {}, updateStore: async () => {}, 
      addOrder: async () => { throw new Error('addOrder not implemented'); },
      updateOrder: async () => {}, deleteOrder: async () => {},
      deleteItemFromOrder: async () => {},
      syncWithSupabase: async () => {},
      addItemToDispatch: async () => {},
      mergeOrders: async () => {},
      upsertItemPrice: async () => {},
      upsertDueReportTopUp: async () => {},
      sendEtaRequest: async () => {},
      pasteItemsForStore: async () => {},
      addQuickOrder: async () => {},
      deleteQuickOrder: async () => {},
  }
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, getInitialState());
  const { notify } = useNotifier();
  const { addNotification } = useNotificationDispatch();
  
  useEffect(() => {
    try {
        const stateToSave = { ...state, isLoading: false, isInitialized: true, notifications: [], dueReportTopUps: [] };
        localStorage.setItem(APP_STATE_KEY, JSON.stringify(stateToSave));
    } catch(err) { console.error("Could not save state to localStorage", err); }
  }, [state]);

  useEffect(() => {
    const handleResize = () => {
        dispatch({ type: 'SET_COLUMN_COUNT', payload: getInitialColumnCount() });
    };
    window.addEventListener('resize', handleResize);
    // Set initial count on mount
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [dispatch]);

  const syncWithSupabase = useCallback(async (options?: { isInitialSync?: boolean }) => {
    dispatch({ type: '_SET_SYNC_STATUS', payload: 'syncing' });
    try {
        if (!navigator.onLine) {
            if (!options?.isInitialSync) notify('Offline. Using cached data.', 'info');
            return dispatch({ type: '_SET_SYNC_STATUS', payload: 'offline' });
        }
        const { supabaseUrl, supabaseKey } = state.settings;
        if (!options?.isInitialSync) notify('Syncing with database...', 'info');

        const { items, suppliers, stores, itemPrices, dueReportTopUps, quickOrders } = await getItemsAndSuppliersFromSupabase({ url: supabaseUrl, key: supabaseKey });
        const orders = await getOrdersFromSupabase({ url: supabaseUrl, key: supabaseKey, suppliers });
        
        dispatch({ type: '_MERGE_DATABASE', payload: { items, suppliers, orders, stores, itemPrices, dueReportTopUps, quickOrders } }); 
        
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
    deleteSupplier: async (supplierId) => {
        await supabaseDeleteSupplier({ supplierId, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: '_DELETE_SUPPLIER', payload: supplierId });
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
        return savedOrder;
    },
    updateOrder: async (order) => {
        const previousOrder = state.orders.find(o => o.id === order.id);

        const updatedOrder = await supabaseUpdateOrder({ order, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: 'UPDATE_ORDER', payload: updatedOrder });
        
        // Notification for "On the Way"
        if (previousOrder && previousOrder.status !== OrderStatus.ON_THE_WAY && order.status === OrderStatus.ON_THE_WAY) {
            const notification: Notification = {
                id: Date.now(),
                message: `Order for ${order.supplierName} (${order.store}) is on the way.`,
                type: 'on_the_way',
                orderId: order.id,
            };
            addNotification(notification.message);
        }
        
        // Stock management logic
        if (previousOrder && previousOrder.status !== OrderStatus.COMPLETED && order.status === OrderStatus.COMPLETED) {
            const isStockMovement = order.supplierName === SupplierName.STOCK || order.paymentMethod === PaymentMethod.STOCK;
            
            if (isStockMovement) {
                const direction = order.supplierName === SupplierName.STOCK ? -1 : 1;
                const itemDbUpdatePromises: Promise<any>[] = [];
                const stockUpdatesForState: { itemId: string; stockQuantity: number }[] = [];

                for (const orderItem of order.items) {
                    const masterItem = state.items.find(i => i.id === orderItem.itemId);
                    if (masterItem) {
                        const newStockQuantity = (masterItem.stockQuantity || 0) + (orderItem.quantity * direction);
                        
                        itemDbUpdatePromises.push(supabaseUpdateItem({
                            item: { ...masterItem, stockQuantity: newStockQuantity },
                            url: state.settings.supabaseUrl,
                            key: state.settings.supabaseKey
                        }));
                        
                        stockUpdatesForState.push({ itemId: masterItem.id, stockQuantity: newStockQuantity });
                    }
                }

                if (itemDbUpdatePromises.length > 0) {
                    await Promise.all(itemDbUpdatePromises);
                    dispatch({ type: '_BATCH_UPDATE_ITEMS_STOCK', payload: stockUpdatesForState });
                    const directionText = direction === 1 ? 'added to' : 'deducted from';
                    notify(`Stock quantity for ${itemDbUpdatePromises.length} item(s) ${directionText} stock.`, 'success');
                }
            }
        }
    },
    deleteOrder: async (orderId) => {
        await supabaseDeleteOrder({ orderId, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: 'DELETE_ORDER', payload: orderId });
        notify(`Order deleted.`, 'success');
    },
    deleteItemFromOrder: async (itemToDelete, sourceOrderId) => {
        const order = state.orders.find(o => o.id === sourceOrderId);
        if (!order) {
            notify(`Could not find order to delete item from.`, 'error');
            return;
        }

        const newItems = order.items.filter(i => 
            !(i.itemId === itemToDelete.itemId && i.isSpoiled === itemToDelete.isSpoiled && i.name === itemToDelete.name)
        );
        // Do not delete the order if it becomes empty. Let the on-blur handler do it.
        await actions.updateOrder({ ...order, items: newItems });
        notify('Item removed.', 'success');
    },
    addItemToDispatch: async (item) => {
        const { activeStore, orders, suppliers } = state;
        if (activeStore === 'Settings' || activeStore === 'ALL') {
            notify('Please select a specific store to add items.', 'info');
            return;
        }
        
        const existingOrder = orders.find(o => 
            o.store === activeStore && 
            o.supplierId === item.supplierId && 
            o.status === OrderStatus.DISPATCHING
        );
    
        if (existingOrder) {
            const itemInOrderIndex = existingOrder.items.findIndex(i => i.itemId === item.id);
            if (itemInOrderIndex > -1) {
                const updatedItems = [...existingOrder.items];
                updatedItems[itemInOrderIndex] = {
                    ...updatedItems[itemInOrderIndex],
                    quantity: updatedItems[itemInOrderIndex].quantity + 1
                };
                await actions.updateOrder({ ...existingOrder, items: updatedItems });
                notify(`Incremented "${item.name}" in existing order.`, 'success');
                return;
            }
            
            const newItem: OrderItem = { itemId: item.id, name: item.name, quantity: 1, unit: item.unit };
            const updatedItems = [...existingOrder.items, newItem];
            await actions.updateOrder({ ...existingOrder, items: updatedItems });
            notify(`Added "${item.name}" to existing order.`, 'success');
        } else {
            const supplier = suppliers.find(s => s.id === item.supplierId);
            if (!supplier) {
                notify(`Supplier for "${item.name}" not found.`, 'error');
                return;
            }
            const newOrderItem: OrderItem = { itemId: item.id, name: item.name, quantity: 1, unit: item.unit };
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
    upsertDueReportTopUp: async (topUp) => {
        const savedTopUp = await supabaseUpsertDueReportTopUp({ topUp, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: 'UPSERT_DUE_REPORT_TOP_UP', payload: savedTopUp });
    },
    sendEtaRequest: async (order: Order) => {
        const { settings, suppliers } = state;
        const supplier = suppliers.find(s => s.id === order.supplierId);
        if (!supplier || !supplier.chatId || !settings.telegramBotToken) {
            notify('ETA request failed: Supplier Chat ID or Bot Token not set.', 'error');
            return;
        }
        const message = `ETA for order ${order.orderId} (${order.store})?`;
        try {
            await sendCustomMessageToSupplier(supplier, message, settings.telegramBotToken);
            notify('ETA request sent.', 'success');
        } catch (e: any) {
            notify(`ETA request failed: ${e.message}`, 'error');
        }
    },
    pasteItemsForStore: async (text, store) => {
        if (!text.trim()) return;

        const isAiEnabled = state.settings.isAiEnabled !== false;
        notify(isAiEnabled ? 'Parsing with AI...' : 'Parsing locally...', 'info');
        
        let parsedItems;
        if (isAiEnabled) {
            const geminiApiKey = state.settings.geminiApiKey;
            if (!geminiApiKey) { notify('Gemini API key not set.', 'error'); return; }
            const rules = state.settings.aiParsingRules || {};
            const activeStoreRules = rules[store] || {};
            const combinedAliases = { ...(rules.global || {}), ...activeStoreRules };
            parsedItems = await parseItemListWithGemini(text, state.items, geminiApiKey, { aliases: combinedAliases });
        } else {
            parsedItems = await parseItemListLocally(text, state.items);
        }
        
        const stockSupplier = state.suppliers.find(s => s.name === SupplierName.STOCK);
        const ordersBySupplier: Record<string, { supplier: Supplier, items: OrderItem[] }> = {};

        for (const pItem of parsedItems) {
            let supplier: Supplier | null = null;
            let orderItem: OrderItem | null = null;
            let masterItem: Item | null = null;

            if (pItem.matchedItemId) {
                const existingItem = state.items.find(i => i.id === pItem.matchedItemId);
                if (existingItem) {
                    masterItem = existingItem;
                    supplier = state.suppliers.find(s => s.id === existingItem.supplierId) || null;
                    orderItem = { itemId: existingItem.id, name: existingItem.name, quantity: pItem.quantity, unit: existingItem.unit };
                }
            } else if (pItem.newItemName) {
                supplier = state.suppliers.find(s => s.name === 'MARKET') || null;
                if (supplier) {
                    const existingItemInDb = state.items.find(i => i.name.toLowerCase() === pItem.newItemName!.toLowerCase() && i.supplierId === supplier!.id);
                    let finalItem: Item;
                    if (existingItemInDb) {
                        finalItem = existingItemInDb;
                    } else {
                        notify(`Creating new item: ${pItem.newItemName}`, 'info');
                        finalItem = await actions.addItem({ name: pItem.newItemName, supplierId: supplier.id, supplierName: supplier.name, unit: normalizeUnit(pItem.unit) ?? Unit.PC });
                    }
                    orderItem = { itemId: finalItem.id, name: finalItem.name, quantity: pItem.quantity, unit: finalItem.unit };
                }
            }

            // Stock availability check
            if (masterItem && stockSupplier && supplier?.id === stockSupplier.id) {
                if ((masterItem.stockQuantity ?? 0) < orderItem!.quantity) {
                    const primarySupplier = state.suppliers.find(s => s.id === masterItem!.supplierId);
                    if (primarySupplier) {
                        supplier = primarySupplier; // Re-assign supplier for grouping
                        notify(`Insufficient stock for "${masterItem.name}". Rerouting to ${primarySupplier.name}.`, 'info');
                    } else {
                        notify(`Could not find primary supplier for "${masterItem.name}". Item skipped.`, 'error');
                        continue; // Skip this item
                    }
                }
            }

            if (supplier && orderItem) {
                if (!ordersBySupplier[supplier.id]) ordersBySupplier[supplier.id] = { supplier, items: [] };
                ordersBySupplier[supplier.id].items.push(orderItem);
            }
        }
        
        let createdCount = 0; let updatedCount = 0;
        for (const { supplier, items } of Object.values(ordersBySupplier)) {
            const existingOrderForSupplier = state.orders.find(o => o.store === store && o.supplierId === supplier.id && o.status === OrderStatus.DISPATCHING);
            if (existingOrderForSupplier) {
                const updatedItems = [...existingOrderForSupplier.items];
                items.forEach(itemToAdd => {
                    const existingItemIndex = updatedItems.findIndex(i => i.itemId === itemToAdd.itemId);
                    if (existingItemIndex !== -1) updatedItems[existingItemIndex].quantity += itemToAdd.quantity;
                    else updatedItems.push(itemToAdd);
                });
                await actions.updateOrder({ ...existingOrderForSupplier, items: updatedItems });
                updatedCount++;
            } else {
                await actions.addOrder(supplier, store, items);
                createdCount++;
            }
        }
        if (createdCount > 0) notify(`${createdCount} new order(s) created.`, 'success');
        if (updatedCount > 0) notify(`${updatedCount} existing order(s) updated.`, 'info');
        if (createdCount === 0 && updatedCount === 0) notify('Could not parse any items.', 'info');
    },
    addQuickOrder: async (quickOrder) => {
        const newQO = await supabaseAddQuickOrder({ quickOrder, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: 'ADD_QUICK_ORDER', payload: newQO });
        notify('Quick Order saved.', 'success');
    },
    deleteQuickOrder: async (id) => {
        await supabaseDeleteQuickOrder({ id, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
        dispatch({ type: 'DELETE_QUICK_ORDER', payload: id });
        notify('Quick Order deleted.', 'success');
    },
    syncWithSupabase,
  };

    // Background polling for acknowledgements and reminders
    useEffect(() => {
        const intervalId = setInterval(async () => {
            if (!navigator.onLine || !state.isInitialized) return;

            // --- Acknowledgement Polling ---
            try {
                const unacknowledgedOnTheWay = state.orders
                    .filter(o => {
                        if (o.status !== OrderStatus.ON_THE_WAY || o.isAcknowledged) {
                            return false;
                        }
                        const supplier = state.suppliers.find(s => s.id === o.supplierId);
                        // Only poll for suppliers who have the OK button enabled
                        return supplier?.botSettings?.showOkButton === true;
                    })
                    .map(o => o.id);

                if (unacknowledgedOnTheWay.length > 0) {
                    const acknowledgedUpdates = await getAcknowledgedOrderUpdates({
                        orderIds: unacknowledgedOnTheWay,
                        url: state.settings.supabaseUrl,
                        key: state.settings.supabaseKey,
                    });

                    for (const ackUpdate of acknowledgedUpdates) {
                        const localOrder = state.orders.find(o => o.id === ackUpdate.id);
                        if (localOrder && !localOrder.isAcknowledged) {
                            notify(`Order ${ackUpdate.order_id} was acknowledged.`, 'success');
                            dispatch({ type: 'UPDATE_ORDER', payload: { ...localOrder, isAcknowledged: true, modifiedAt: new Date().toISOString() } });
                        }
                    }
                }
            } catch (e: any) {
              // Be less noisy with fetch errors, which are common when offline
              if (e?.message && !e.message.includes('Failed to fetch')) {
                console.warn('Background sync for acknowledgements failed:', e);
              }
            }

            // --- Reminder Polling ---
            try {
                const FORTY_FIVE_MINUTES = 45 * 60 * 1000;
                const ordersToRemind = state.orders.filter(o => {
                    if (o.status !== OrderStatus.ON_THE_WAY || o.isAcknowledged || o.reminderSentAt) return false;
                    const supplier = state.suppliers.find(s => s.id === o.supplierId);
                    if (!supplier?.botSettings?.showOkButton || !supplier.botSettings.enableReminderTimer) return false;
                    const timeDiff = new Date().getTime() - new Date(o.modifiedAt).getTime();
                    return timeDiff > FORTY_FIVE_MINUTES;
                });
                
                if (ordersToRemind.length > 0 && state.settings.telegramBotToken) {
                    for (const order of ordersToRemind) {
                        const supplier = state.suppliers.find(s => s.id === order.supplierId)!;
                        await sendReminderToSupplier(order, supplier, state.settings.telegramBotToken);
                        const updatedOrder = await supabaseUpdateOrder({ order: { ...order, reminderSentAt: new Date().toISOString() }, url: state.settings.supabaseUrl, key: state.settings.supabaseKey });
                        dispatch({ type: 'UPDATE_ORDER', payload: updatedOrder });
                    }
                }
            } catch (e) { console.warn('Background check for reminders failed:', e); }

        }, 30000); // Poll every 30 seconds

        return () => clearInterval(intervalId);
    }, [state.isInitialized, state.settings, state.orders, state.suppliers, dispatch, notify]);


  // Global error handler for actions
  const wrappedActions = { ...actions };
  for (const actionName in wrappedActions) {
      if (Object.prototype.hasOwnProperty.call(wrappedActions, actionName)) {
        const originalAction = (wrappedActions as any)[actionName];
        (wrappedActions as any)[actionName] = async (...args: any[]) => {
            try {
                return await originalAction(...args);
            } catch (e: any) {
                if (e.name !== 'AbortError' && !e.message.includes('Failed to fetch')) {
                    notify(`Error: ${e.message}`, 'error');
                }
            }
        };
      }
  }

  return (
    <AppContext.Provider value={{ state, dispatch, actions: wrappedActions }}>
      {children}
    </AppContext.Provider>
  );
};