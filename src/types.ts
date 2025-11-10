import { StoreName as StoreNameEnum, Unit as UnitEnum, OrderStatus as OrderStatusEnum, SupplierName as SupplierNameEnum } from './constants';

// Re-exporting enums from constants to be the single source of truth for types
export const StoreName = StoreNameEnum;
export type StoreName = StoreNameEnum;

export const SupplierName = SupplierNameEnum;
export type SupplierName = SupplierNameEnum;

export const Unit = UnitEnum;
export type Unit = UnitEnum;

export const OrderStatus = OrderStatusEnum;
export type OrderStatus = OrderStatusEnum;

export enum PaymentMethod {
  ABA = 'aba',
  CASH = 'cash',
  KALI = 'kali',
  STOCK = 'stock',
  MISHA = 'misha',
}

// FIX: Define SyncStatus here to be the single source of truth.
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';
export type SettingsTab = 'items' | 'suppliers' | 'stores' | 'templates' | 'telegram-bot';

export interface Store {
  id: string; // uuid from Supabase
  name: StoreName;
  chatId?: string;
  locationUrl?: string;
}

export interface Item {
  id: string; // uuid from Supabase
  name: string;
  unit: Unit;
  supplierId: string; // Foreign key to the suppliers table
  // Denormalized for easier front-end use
  supplierName: SupplierName; 
  createdAt?: string;
  modifiedAt?: string;
  trackStock?: boolean;
  stockQuantity?: number;
  parentId?: string; // Foreign key to self for variants
  isVariant?: boolean;
}

export interface SupplierBotSettings {
  showAttachInvoice?: boolean;
  showMissingItems?: boolean;
  showOkButton?: boolean;
  showDriverOnWayButton?: boolean;
  includeLocation?: boolean;
  messageTemplate?: string;
}

export interface Supplier {
  id: string; // uuid from Supabase
  name: SupplierName;
  chatId?: string; // Replaces telegramGroupId for clarity
  paymentMethod?: PaymentMethod; // For persisting payment choice
  modifiedAt?: string;
  botSettings?: SupplierBotSettings;
}

export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  unit?: Unit;
  isSpoiled?: boolean;
  isNew?: boolean;
  // FIX: Add optional price property to OrderItem to allow for price overrides per item in an order.
  price?: number;
}

export interface Order {
  id: string; // Supabase UUID
  orderId: string; // Human-readable ID
  store: StoreName;
  supplierId: string; // Foreign key to the suppliers table
  supplierName: SupplierName; // Denormalized for easier front-end use
  items: OrderItem[];
  status: OrderStatus;
  isSent: boolean;
  isReceived: boolean;
  createdAt: string;
  modifiedAt: string;
  completedAt?: string;
  invoiceUrl?: string;
  invoiceAmount?: number;
  paymentMethod?: PaymentMethod;
  isAcknowledged?: boolean;
}

export interface ParsedItem {
  matchedItemId?: string;
  newItemName?: string;
  quantity: number;
  unit?: Unit;
}

export interface ItemPrice {
    id?: string; // Supabase UUID
    itemId: string;
    supplierId: string;
    price: number;
    unit: Unit;
    isMaster: boolean;
}

export interface AiParsingRules {
    global?: Record<string, string>;
    [storeName: string]: Record<string, string> | undefined; // Per-store rules
}

export interface AppSettings {
    supabaseUrl: string;
    supabaseKey: string;
    isAiEnabled?: boolean;
    lastSyncedCsvContent?: string;
    csvUrl?: string;
    geminiApiKey?: string;
    telegramBotToken?: string;
    aiParsingRules?: AiParsingRules;
    receiptTemplates?: Record<string, string>; // e.g. { 'default': '<html>...' }
    messageTemplates?: { [key: string]: string; };
}

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
