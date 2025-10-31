import { AppState } from '../context/AppContext';
import { Order, OrderStatus, Store, StoreName } from '../types';
import { appendToSheet } from './googleSheetsService';

interface ReportingParams {
  stores: Store[];
  orders: Order[];
  settings: AppState['settings'];
  supabaseCreds: {
    url: string;
    key: string;
  };
}

export const generateAndRunDailyReports = async ({ stores, orders, settings, supabaseCreds }: ReportingParams) => {
    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // FIX: Correctly typed `allStores` to prevent a type error where `store.name` (type `StoreName`) was compared to a string literal 'KALI' which it could never be.
    const allStores: { name: StoreName | 'KALI' }[] = [...stores, { name: 'KALI' }];

    for (const store of allStores) {
        const spreadsheetId = settings.spreadsheetIds?.[store.name];
        if (!spreadsheetId) {
            console.log(`Skipping report for ${store.name}: no spreadsheet ID configured.`);
            continue;
        }

        const todaysCompletedOrders = orders.filter(o => {
            const isCompletedToday = o.status === OrderStatus.COMPLETED && o.completedAt?.startsWith(todayDateString);
            // KALI is a special case that aggregates orders from its own supplier name
            if (store.name === 'KALI') {
                return o.supplierName === 'KALI' && isCompletedToday;
            }
            return o.store === store.name && isCompletedToday;
        });

        if (todaysCompletedOrders.length === 0) {
            console.log(`No completed orders today for ${store.name}.`);
            continue;
        }

        const reportRows: (string | number)[][] = [];
        // Header Row
        reportRows.push(['Order ID', 'Supplier', 'Item', 'Quantity', 'Unit', 'Completed At', 'Store']);

        for (const order of todaysCompletedOrders) {
            for (const item of order.items) {
                reportRows.push([
                    order.orderId,
                    order.supplierName,
                    item.name,
                    item.quantity,
                    item.unit || '',
                    order.completedAt || '',
                    order.store,
                ]);
            }
        }
        
        try {
            // Use the store name as the sheet name for better organization
            const sheetName = store.name;
            console.log(`Sending report for ${store.name} to spreadsheet ${spreadsheetId}, sheet ${sheetName}`);
            await appendToSheet({
                spreadsheetId,
                sheetName,
                values: reportRows,
            }, supabaseCreds);
        } catch (error) {
            console.error(`Failed to generate report for ${store.name}:`, error);
            // The error will be caught and toasted by the AppContext action wrapper
            throw error;
        }
    }
};