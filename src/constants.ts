export enum StoreName {
    CV2 = 'CV2',
    STOCK02 = 'STOCKO2',
    WB = 'WB',
    SHANTI = 'SHANTI',
    OUDOM = 'OUDOM',
    KALI = 'KALI',
}

export enum SupplierName {
    ANGKOR_MILK = 'ANGKOR MILK',
    P_AND_P = 'P&P',
    MARKET = 'MARKET',
    KALI = 'KALI',
    MIKHAIL = 'MIKHAIL',
    OUDOM = 'OUDOM',
    STOCK = 'STOCK',
}

export enum Unit {
    KG = 'kg',
    PC = 'pc',
    L = 'l',
    BOX = 'box',
    PK = 'pk',
    BT = 'bt',
    CAN = 'can',
    ROLL = 'roll',
    BLOCK = 'block',
    GLASS = 'glass',
}

export enum OrderStatus {
    DISPATCHING = 'dispatching',
    ON_THE_WAY = 'on_the_way',
    COMPLETED = 'completed',
}

export const STATUS_TABS: { id: OrderStatus; label: string }[] = [
    { id: OrderStatus.DISPATCHING, label: 'Dispatch' },
    { id: OrderStatus.ON_THE_WAY, label: 'On the Way' },
    { id: OrderStatus.COMPLETED, label: 'Completed' },
];