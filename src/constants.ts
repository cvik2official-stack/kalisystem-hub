export enum StoreName {
  CV2 = 'CV2',
  STOCK02 = 'STOCK02',
  WB = 'WB',
  SHANTI = 'SHANTI',
  KALI = 'KALI',
}

// This now matches the supplier_enum in the database
export enum SupplierName {
    KALI = 'KALI',
    PISEY = 'PISEY',
    MARKET = 'MARKET',
    LEES = 'LEES',
    ANGKOR_COMPANY = 'ANGKOR-COMPANY',
    COCA_COMPANY = 'COCA-COMPANY',
    CHARONAI = 'CHARONAI',
    KOFI = 'KOFI',
    TAKEAWAY_SHOP = 'TAKEAWAY-SHOP',
    STOCK = 'STOCK',
    PZZA_PLUS = 'PZZA+',
}


export enum OrderStatus {
  DISPATCHING = 'dispatching',
  ON_THE_WAY = 'on_the_way',
  COMPLETED = 'completed',
}

// This now matches the unit_enum in the database
export enum Unit {
  KG = 'kg',
  PC = 'pc',
  L = 'L',
  ROLL = 'roll',
  BLOCK = 'block',
  BOX = 'box',
  PK = 'pk',
  BT = 'bt',
  GLASS = 'glass',
  CAN = 'can',
}

export const STATUS_TABS: { id: OrderStatus; label: string }[] = [
  { id: OrderStatus.DISPATCHING, label: 'Dispatching' },
  { id: OrderStatus.ON_THE_WAY, label: 'On the Way' },
  { id: OrderStatus.COMPLETED, label: 'Completed' },
];