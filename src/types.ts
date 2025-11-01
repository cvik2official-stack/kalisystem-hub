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
}
// FIX: Removed conflicting type alias for the PaymentMethod enum.
// The enum declaration itself serves as the type, and this was causing a redeclaration error.

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
  chatId?: string; // Replaces telegramGroupId for clarity
  paymentMethod?: PaymentMethod; // For persisting payment choice
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
}

export interface ParsedItem {
  matchedItemId?: string;
  newItemName?: string;
  quantity: number;
  unit?: Unit;
}