import { Order, ItemPrice, DueReportTopUp, StoreName, SupplierName, PaymentMethod, Supplier } from '../types';
import { getLocalDateKey, calculateOrderTotal } from '../utils/messageFormatter';

interface DueReportData {
    ordersForReport: Order[];
    previousDue: number;
    topUpToday: number;
}

export const calculateDueReportData = (
    orders: Order[],
    suppliers: Supplier[],
    itemPrices: ItemPrice[],
    dueReportTopUps: DueReportTopUp[],
    targetDateKey: string
): DueReportData => {
    // 1. Configuration Constants
    const startDateStr = '2025-11-01';
    const hardcodedInitialBalance = 146.26;
    const storesToTrack = [StoreName.CV2, StoreName.SHANTI, StoreName.STOCK02, StoreName.WB];

    const topUpsMap = new Map(dueReportTopUps.map(t => [t.date, t.amount]));

    // 2. Filter relevant orders (KALI related)
    const kaliOrders = orders.filter(o => {
        if (o.status !== 'completed' || !o.completedAt) return false;
        const supplier = suppliers.find(s => s.id === o.supplierId);
        const paymentMethod = o.paymentMethod || supplier?.paymentMethod;
        return paymentMethod === PaymentMethod.KALI || supplier?.name === SupplierName.KALI;
    });

    // 3. Calculate Previous Due (Running balance up to yesterday)
    let runningDue = hardcodedInitialBalance;
    
    // Generate dates from start to target date
    let currentDate = new Date(startDateStr);
    const endDate = new Date(targetDateKey);
    
    // Safety break for loop
    let safety = 0;
    
    while (currentDate <= endDate && safety < 2000) {
        const currentKey = getLocalDateKey(currentDate);
        
        // Stop if we reached the target date (we only want PREVIOUS due)
        if (currentKey === targetDateKey) break;

        const topUp = topUpsMap.get(currentKey) || 0;
        
        let dailySpend = 0;
        kaliOrders.forEach(order => {
            if (getLocalDateKey(order.completedAt) === currentKey && storesToTrack.includes(order.store)) {
                dailySpend += calculateOrderTotal(order, itemPrices);
            }
        });
        
        runningDue = runningDue + topUp - dailySpend;
        
        currentDate.setDate(currentDate.getDate() + 1);
        safety++;
    }

    const previousDue = runningDue;
    const topUpToday = topUpsMap.get(targetDateKey) || 0;

    // 4. Get orders for the specific target date
    const ordersForReport = kaliOrders.filter(order => 
        getLocalDateKey(order.completedAt) === targetDateKey
    );

    return {
        ordersForReport,
        previousDue,
        topUpToday
    };
};