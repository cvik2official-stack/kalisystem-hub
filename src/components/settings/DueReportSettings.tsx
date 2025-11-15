import React, { useContext, useMemo, useState, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import { Order, ItemPrice, StoreName, PaymentMethod } from '../../types';
import { getLatestItemPrice } from '../../utils/messageFormatter';

interface DueReportSettingsProps {
    setMenuOptions: (options: any[]) => void;
}

const DueReportSettings: React.FC<DueReportSettingsProps> = ({ setMenuOptions }) => {
    const { state, dispatch, actions } = useContext(AppContext);
    const { orders, suppliers, itemPrices, dueReportTopUps, settings } = state;

    const [initialBalance, setInitialBalance] = useState(settings.dueReportInitialBalance || 0);

    const handleInitialBalanceChange = (value: string) => {
        const amount = parseFloat(value) || 0;
        setInitialBalance(amount);
        dispatch({ type: 'SAVE_SETTINGS', payload: { dueReportInitialBalance: amount } });
    };

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
            return paymentMethod === PaymentMethod.KALI;
        });

        kaliOrders.forEach(order => {
            const date = new Date(order.completedAt!);
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            
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
        const dates = Object.keys(dailyKALIspend).concat(Array.from(topUpsMap.keys()));
        const startDate = new Date('2025-11-01T00:00:00Z');
        
        const relevantDates = dates.filter(dateKey => new Date(dateKey + 'T00:00:00Z') >= startDate);
        if (relevantDates.length === 0) return [];
        
        const uniqueSortedDates = [...new Set(relevantDates)].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        
        let runningDue = initialBalance;
        const rows: any[] = [];

        for (const dateKey of uniqueSortedDates) {
            const spend = dailyKALIspend[dateKey] || {};
            const totalSpend = storesToTrack.reduce((sum, store) => sum + (spend[store] || 0), 0);
            const topUp = topUpsMap.get(dateKey) || 0;
            
            runningDue = runningDue + topUp - totalSpend;
            
            rows.push({
                date: new Date(dateKey + 'T00:00:00'),
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
    }, [dailyKALIspend, topUpsMap, initialBalance]);

    const formatCurrency = (amount: number) => amount === 0 ? '-' : amount.toFixed(2);
    
    const handleExportToCsv = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        const headers = ["Date", "Top Up", ...storesToTrack, "Due"];
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
            <div className="mb-4 max-w-xs">
                <label htmlFor="initial-balance" className="block text-sm font-medium text-gray-300">Initial Due Balance (Nov 1)</label>
                <input
                    type="text"
                    id="initial-balance"
                    inputMode="decimal"
                    value={initialBalance}
                    onChange={(e) => handleInitialBalanceChange(e.target.value)}
                    className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            <div className="overflow-x-auto hide-scrollbar">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                        <tr>
                            <th scope="col" className="px-1 md:px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                            <th scope="col" className="px-1 md:px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Top Up</th>
                            {storesToTrack.map(store => (
                                <th key={store} scope="col" className="px-1 md:px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{store}</th>
                            ))}
                            <th scope="col" className="px-1 md:px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Due</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {reportRows.map(row => (
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
                                        className="bg-transparent p-1 w-16 md:w-24 rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </td>
                                <td className="px-1 md:px-3 py-2 whitespace-nowrap text-sm text-gray-300">{formatCurrency(row.cv2)}</td>
                                <td className="px-1 md:px-3 py-2 whitespace-nowrap text-sm text-gray-300">{formatCurrency(row.shanti)}</td>
                                <td className="px-1 md:px-3 py-2 whitespace-nowrap text-sm text-gray-300">{formatCurrency(row.stock02)}</td>
                                <td className="px-1 md:px-3 py-2 whitespace-nowrap text-sm text-gray-300">{formatCurrency(row.wb)}</td>
                                <td className={`px-1 md:px-3 py-2 whitespace-nowrap text-sm font-semibold ${row.due < 0 ? 'text-red-400' : 'text-green-400'}`}>{formatCurrency(row.due)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DueReportSettings;