import React, { useContext, useMemo, useState, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import { Order, ItemPrice, StoreName, PaymentMethod, SupplierName } from '../../types';
import { getLatestItemPrice, generateKaliUnifyReport, getPhnomPenhDateKey } from '../../utils/messageFormatter';
import { useNotifier } from '../../context/NotificationContext';
import { sendDueReport } from '../../services/telegramService';

interface DueReportSettingsProps {
    setMenuOptions: (options: any[]) => void;
}

const DueReportSettings: React.FC<DueReportSettingsProps> = ({ setMenuOptions }) => {
    const { state, actions } = useContext(AppContext);
    const { orders, suppliers, itemPrices, dueReportTopUps, settings } = state;
    const { notify } = useNotifier();
    const [sendingReportDate, setSendingReportDate] = useState<string | null>(null);

    const calculateOrderTotal = (order: Order, itemPrices: ItemPrice[]): number => {
        return order.items.reduce((total, item) => {
            if (item.isSpoiled) return total;
            const latestPrice = getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price ?? 0;
            return total + ((item.price ?? latestPrice) * item.quantity);
        }, 0);
    };
    
    const storesToTrack: StoreName[] = [StoreName.CV2, StoreName.SHANTI, StoreName.STOCK02, StoreName.WB];

    const dailyKALIspend = useMemo(() => {
        const spendMap: Record<string, Record<string, number>> = {};
        
        const kaliOrders = orders.filter(o => {
            if (o.status !== 'completed' || !o.completedAt) return false;
            const supplier = suppliers.find(s => s.id === o.supplierId);
            const paymentMethod = o.paymentMethod || supplier?.paymentMethod;
            return paymentMethod === PaymentMethod.KALI || supplier?.name === SupplierName.KALI;
        });

        kaliOrders.forEach(order => {
            const dateKey = getPhnomPenhDateKey(order.completedAt);
            
            if (!spendMap[dateKey]) {
                spendMap[dateKey] = {};
                storesToTrack.forEach(s => spendMap[dateKey][s] = 0);
            }
            if (storesToTrack.includes(order.store)) {
                const orderTotal = calculateOrderTotal(order, itemPrices);
                spendMap[dateKey][order.store] = (spendMap[dateKey][order.store] || 0) + orderTotal;
            }
        });
        return spendMap;
    }, [orders, suppliers, itemPrices]);

    const topUpsMap = useMemo(() => {
        return new Map(dueReportTopUps.map(t => [t.date, t.amount]));
    }, [dueReportTopUps]);

    const handleTopUpChange = (dateKey: string, value: string) => {
        const amount = parseFloat(value) || 0;
        if (amount === 0 && !topUpsMap.has(dateKey)) {
            return;
        }
        actions.upsertDueReportTopUp({ date: dateKey, amount });
    };

    const reportRows = useMemo(() => {
        // Collect all dates from data
        const datesSet = new Set<string>([
            ...Object.keys(dailyKALIspend),
            ...Array.from(topUpsMap.keys())
        ]);
        
        const startDateStr = '2025-11-01';
        const todayKey = getPhnomPenhDateKey();
        
        // Generate continuous date range from startDate to today
        const current = new Date(startDateStr + 'T12:00:00Z');
        const end = new Date(todayKey + 'T12:00:00Z');
        
        while (current <= end) {
            datesSet.add(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        
        const uniqueSortedDates = Array.from(datesSet)
            .filter(d => d >= startDateStr)
            .sort();
        
        const hardcodedInitialBalance = 146.26;
        let runningDue = hardcodedInitialBalance;
        const rows: any[] = [];

        for (const dateKey of uniqueSortedDates) {
            const spend = dailyKALIspend[dateKey] || {};
            const totalSpend = storesToTrack.reduce((sum, store) => sum + (spend[store] || 0), 0);
            const topUp = topUpsMap.get(dateKey) || 0;
            
            runningDue = runningDue + topUp - totalSpend;
            
            // Create a date object at noon to avoid timezone shifting issues when displaying
            const displayDate = new Date(dateKey + 'T12:00:00');

            rows.push({
                date: displayDate,
                dateKey,
                topUp,
                cv2: spend[StoreName.CV2] || 0,
                shanti: spend[StoreName.SHANTI] || 0,
                stock02: spend[StoreName.STOCK02] || 0,
                wb: spend[StoreName.WB] || 0,
                due: runningDue,
            });
        }

        return rows.reverse(); // Show most recent first
    }, [dailyKALIspend, topUpsMap]);

    const handleSendDailyReport = async (row: any, index: number) => {
        const { telegramBotToken } = settings;
        if (!telegramBotToken) {
            notify('Telegram Bot Token is not set in Settings.', 'error');
            return;
        }

        setSendingReportDate(row.dateKey);
        try {
            const hardcodedInitialBalance = 146.26;
            const previousDue = reportRows[index + 1]?.due ?? hardcodedInitialBalance;
            const topUp = row.topUp || 0;
            
            const ordersForDate = orders.filter(order => {
                if (!order.completedAt) return false;
                const completedDateKey = getPhnomPenhDateKey(order.completedAt);
                if (completedDateKey !== row.dateKey) return false;
                
                const supplier = suppliers.find(s => s.id === order.supplierId);
                const paymentMethod = order.paymentMethod || supplier?.paymentMethod;
                return paymentMethod === PaymentMethod.KALI || supplier?.name === SupplierName.KALI;
            });
            
            const message = generateKaliUnifyReport(ordersForDate, itemPrices, previousDue, topUp, row.dateKey, row.dateKey);
            await sendDueReport(message, telegramBotToken);
            notify(`Report for ${row.dateKey} sent successfully!`, 'success');

        } catch (error: any) {
            notify(`Failed to send report: ${error.message}`, 'error');
        } finally {
            setSendingReportDate(null);
        }
    };


    const formatCurrency = (amount: number) => amount === 0 ? '-' : amount.toFixed(2);
    
    const handleExportToCsv = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ["Date", "Top Up", "CV2", "STI", "O2", "WB", "Due"];
        csvContent += headers.join(",") + "\r\n";

        [...reportRows].reverse().forEach(row => {
            const rowData = [
                row.date.toLocaleDateString('en-CA'),
                row.topUp.toFixed(2),
                row.cv2.toFixed(2),
                row.shanti.toFixed(2),
                row.stock02.toFixed(2),
                row.wb.toFixed(2),
                row.due.toFixed(2),
            ];
            csvContent += rowData.join(",") + "\r\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "due_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    useEffect(() => {
        const options = [{ label: 'Export to CSV', action: handleExportToCsv }];
        setMenuOptions(options);
        return () => setMenuOptions([]);
    }, [reportRows]);

    return (
        <div className="flex flex-col flex-grow w-full">
            <div className="overflow-x-auto hide-scrollbar">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                        <tr>
                            <th scope="col" className="px-1 md:px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                            <th scope="col" className="px-1 md:px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Top Up</th>
                            <th scope="col" className="px-1 md:px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">CV2</th>
                            <th scope="col" className="px-1 md:px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">STI</th>
                            <th scope="col" className="px-1 md:px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">O2</th>
                            <th scope="col" className="px-1 md:px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">WB</th>
                            <th scope="col" className="px-1 md:px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Due</th>
                            <th scope="col" className="px-1 md:px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {reportRows.map((row, index) => (
                            <tr key={row.dateKey} className="hover:bg-gray-700/50">
                                <td className="px-1 md:px-3 py-2 whitespace-nowrap text-sm text-gray-300">
                                    {row.date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                                </td>
                                <td className="px-1 md:px-3 py-2 whitespace-nowrap text-sm text-gray-300">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        defaultValue={row.topUp || ''}
                                        onBlur={(e) => handleTopUpChange(row.dateKey, e.target.value)}
                                        placeholder="-"
                                        className="bg-transparent p-1 w-16 rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </td>
                                <td className="px-1 md:px-3 py-2 whitespace-nowrap text-sm text-gray-300">{formatCurrency(row.cv2)}</td>
                                <td className="px-1 md:px-3 py-2 whitespace-nowrap text-sm text-gray-300">{formatCurrency(row.shanti)}</td>
                                <td className="px-1 md:px-3 py-2 whitespace-nowrap text-sm text-gray-300">{formatCurrency(row.stock02)}</td>
                                <td className="px-1 md:px-3 py-2 whitespace-nowrap text-sm text-gray-300">{formatCurrency(row.wb)}</td>
                                <td className={`px-1 md:px-3 py-2 whitespace-nowrap text-sm font-semibold ${row.due < 0 ? 'text-red-400' : 'text-green-400'}`}>{formatCurrency(row.due)}</td>
                                <td className="px-1 md:px-3 py-2 whitespace-nowrap text-sm text-gray-300 text-center">
                                    <button
                                        onClick={() => handleSendDailyReport(row, index)}
                                        disabled={sendingReportDate === row.dateKey}
                                        className="text-blue-400 hover:text-blue-300 disabled:text-gray-500"
                                        title="Send daily report to Telegram"
                                    >
                                        {sendingReportDate === row.dateKey ? (
                                            <svg className="animate-spin h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.51.71l-4.84-3.56-2.22 2.15c-.22.21-.4.33-.7.33z"></path></svg>
                                        )}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 text-center text-xs text-gray-500">
                Initial Due Balance (Nov 1): <span className="font-semibold text-gray-400">146.26</span>
            </div>
        </div>
    );
};

export default DueReportSettings;