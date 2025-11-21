
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

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';
export type SettingsTab = 'items' | 'suppliers' | 'stores' | 'integrations' | 'due-report';

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
  stockQuantity?: number;
}

export interface SupplierBotSettings {
  showAttachInvoice?: boolean;
  showMissingItems?: boolean;

  showOkButton?: boolean;
  showDriverOnWayButton?: boolean;
  includeLocation?: boolean;
  messageTemplate?: string;
  enableReminderTimer?: boolean;
  reminderMessageTemplate?: string;
}

export interface Supplier {
  id: string; // uuid from Supabase
  name: SupplierName;
  chatId?: string; // Replaces telegramGroupId for clarity
  paymentMethod?: PaymentMethod; // For persisting payment choice
  modifiedAt?: string;
  botSettings?: SupplierBotSettings;
  contact?: string;
}

export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  unit?: Unit;
  price?: number;
  isSpoiled?: boolean;
  isNew?: boolean;
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
  reminderSentAt?: string;
}

export interface QuickOrder {
    id: string;
    name: string;
    store: StoreName;
    supplierId: string;
    supplierName: SupplierName;
    items: OrderItem[];
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
    createdAt?: string;
    isMaster?: boolean;
}

export interface AiParsingRules {
    global?: Record<string, string>;
    [storeName: string]: Record<string, string> | undefined; // Per-store rules
}

export interface DueReportTopUp {
    date: string; // YYYY-MM-DD
    amount: number;
}

export interface Notification {
  id: number;
  message: string;
  type?: 'on_the_way';
  orderId?: string;
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
