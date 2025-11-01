import { StoreName as StoreNameEnum, Unit as UnitEnum, OrderStatus as OrderStatusEnum, SupplierName as SupplierNameEnum, PaymentMethod as PaymentMethodEnum } from './constants';

// Re-exporting enums from constants to be the single source of truth for types
export const StoreName = StoreNameEnum;
export type StoreName = StoreNameEnum;

export const SupplierName = SupplierNameEnum;
export type SupplierName = SupplierNameEnum;

export const Unit = UnitEnum;
export type Unit = UnitEnum;

export const OrderStatus = OrderStatusEnum;
export type OrderStatus = OrderStatusEnum;

export const PaymentMethod = PaymentMethodEnum;
export type PaymentMethod = PaymentMethodEnum;

export interface Store {
  name: StoreName;
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
}

export interface Supplier {
  id: string; // uuid from Supabase
  name: SupplierName;
  // FIX: Add telegramGroupId to support integration settings.
  telegramGroupId?: string;
  // FIX: Added modifiedAt to match the database schema and allow for timestamp tracking.
  modifiedAt?: string;
}

export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  unit?: Unit;
  isSpoiled?: boolean;
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
  paymentMethod?: PaymentMethod | null;
  exportedToCrmAt?: string | null;
}

export interface ParsedItem {
  matchedItemId?: string;
  newItemName?: string;
  quantity: number;
  unit?: Unit;
}