export enum StoreName {
    CV2 = 'CV2',
    STOCK02 = 'STOCKO2',
    WB = 'WB',
    SHANTI = 'SHANTI',
    KALI = 'KALI',
}

export enum SupplierName {
    ANGKOR_MILK = 'ANGKOR MILK',
    P_AND_P = 'P&P',
    MARKET = 'MARKET',
    KALI = 'KALI',
    MIKHAIL = 'MIKHAIL',
    STOCK_OUT = 'STOCK-OUT', // Renamed from STOCK
    PISEY = 'PISEY',
}

export enum Unit {
    KG = 'kg',
    PC = 'pc',
    L = 'L',
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

export const STORE_TAGS = [
    'CV2', 'cv2',
    'SHANTI', 'STI', 'shanti',
    'WB', 'wb',
    'STOCKO2', 'O2', 'stocko2',
    'KALI', 'kali'
];

// Map specific tags/stores to specific styles
export const SPECIAL_TAG_COLORS: Record<string, string> = {
    'KALI': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'CV2': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'WB': 'bg-green-500/20 text-green-300 border-green-500/30',
    'SHANTI': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'STI': 'bg-blue-500/20 text-blue-300 border-blue-500/30', // Alias for SHANTI
    'STOCKO2': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'O2': 'bg-orange-500/20 text-orange-300 border-orange-500/30', // Alias for STOCKO2
    'new': 'bg-lime-500/20 text-lime-300 border-lime-500/30',
    'stock': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

export const TAG_COLORS = [
    'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'bg-pink-500/20 text-pink-300 border-pink-500/30',
    'bg-teal-500/20 text-teal-300 border-teal-500/30',
    'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    'bg-red-500/20 text-red-300 border-red-500/30',
];

export const stringToColorClass = (str: string) => {
    // Check for explicit colors first (case-insensitive check for keys)
    const upperStr = str.toUpperCase();
    
    // Direct matches for proper casing or lowercase "new"/"stock"
    if (SPECIAL_TAG_COLORS[str]) return SPECIAL_TAG_COLORS[str];
    
    // Case-insensitive fallback for known store tags
    const keys = Object.keys(SPECIAL_TAG_COLORS);
    for (const key of keys) {
        if (key.toUpperCase() === upperStr) return SPECIAL_TAG_COLORS[key];
    }

    // Default hashing for random tags
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % TAG_COLORS.length;
    return TAG_COLORS[index];
};