import { Order, Supplier, Item } from '../types';
import callGoogleSheetsExporter from './googleSheetsService';

interface ServiceParams {
    orders: Order[];
    date: string;
    credentials: { url: string; key: string };
}

interface CrmParams extends ServiceParams {
    suppliers: Supplier[];
}

interface StockReportParams extends ServiceParams {
    items: Item[];
}

const CRM_SPREADSHEET_ID = '1CYA0GehEiLVhiSonIi_6hHQWg4VQ88_8hdrz8s_BFD8';
const STOCK_REPORT_SPREADSHEET_ID = '1aarnT_KZQDthYotMzPjVp3K4cwQHGJgyseskoj9joes';

export const exportCrmSummary = async ({ orders, suppliers, date, credentials }: CrmParams): Promise<void> => {
    const supplierMap = new Map(suppliers.map(s => [s.id, s]));

    const dataForSheet = orders.map(order => {
        const supplier = supplierMap.get(order.supplierId);
        return {
            store: order.store,
            supplier: order.supplierName,
            paymentMethod: supplier?.paymentMethod || 'N/A',
            orderId: order.orderId
        };
    });

    await callGoogleSheetsExporter({
        spreadsheetId: CRM_SPREADSHEET_ID,
        data: dataForSheet,
        sheetName: date,
        type: 'CRM_SUMMARY'
    }, credentials);
};

export const exportStockReport = async ({ orders, items, date, credentials }: StockReportParams): Promise<void> => {
    const trackedItems = new Map(
        items.filter(i => i.trackStock).map(i => [i.id, i])
    );
    
    // Aggregate quantities for all tracked items across all completed orders for the day
    const itemQuantities: Record<string, { name: string; store: string; totalQuantity: number }> = {};
    
    const relevantOrders = orders.filter(o => {
        const completedDate = new Date(o.completedAt || 0);
        return o.completedAt && completedDate.toISOString().startsWith(date);
    });

    for (const order of relevantOrders) {
        for (const orderItem of order.items) {
            if (trackedItems.has(orderItem.itemId)) {
                const key = `${order.store}_${orderItem.itemId}`;
                if (!itemQuantities[key]) {
                    itemQuantities[key] = {
                        name: orderItem.name,
                        store: order.store,
                        totalQuantity: 0,
                    };
                }
                itemQuantities[key].totalQuantity += orderItem.quantity;
            }
        }
    }
    
    const dataForSheet = Object.values(itemQuantities);
    
    await callGoogleSheetsExporter({
        spreadsheetId: STOCK_REPORT_SPREADSHEET_ID,
        data: dataForSheet,
        sheetName: date,
        type: 'STOCK_REPORT'
    }, credentials);
};
