import React, { useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { Order, ItemPrice, StoreName, PaymentMethod } from '../../types';
import { getLatestItemPrice } from '../../utils/messageFormatter';

const DueReportSettings: React.FC = () => {
    const { state, dispatch } = useContext(AppContext);
    const { orders, suppliers, itemPrices, settings } = state;

    const calculateOrderTotal = (order: Order, itemPrices: ItemPrice[]): number => {
        return order.items.reduce((total, item) => {
            if (item.isSpoiled) return total;
            const latestPrice = getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price ?? 0;
            return total + ((item.price ?? latestPrice) * item.quantity);
        }, 0);
    };
    
    // FIX: Corrected typo from STOCKO2 to STOCK02
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

    const topUps = settings.dueReportTopUps || {};

    const handleTopUpChange = (dateKey: string, value: string) => {
        const newTopUp = parseFloat(value) || 0;
        const updatedTopUps = { ...topUps, [dateKey]: newTopUp };
        dispatch({ type: 'SAVE_SETTINGS', payload: { dueReportTopUps: updatedTopUps } });
    };

    const reportRows = useMemo(() => {
        const dates = Object.keys(dailyKALIspend).concat(Object.keys(topUps));
        if (dates.length === 0) return [];
        
        const uniqueDates = [...new Set(dates)].sort();
        const startDate = new Date(uniqueDates[0]);
        const endDate = new Date(); // Today
        
        let previousDue = 0;
        const rows: any[] = [];
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            
            const spend = dailyKALIspend[dateKey] || {};
            const totalSpend = storesToTrack.reduce((sum, store) => sum + (spend[store] || 0), 0);
            const topUp = topUps[dateKey] || 0;

            if (totalSpend === 0 && topUp === 0) continue; 
            
            const due = previousDue + topUp - totalSpend;
            
            rows.push({
                date: new Date(d),
                dateKey,
                topUp,
                cv2: spend[StoreName.CV2] || 0,
                shanti: spend[StoreName.SHANTI] || 0,
                // FIX: Corrected typo from STOCKO2 to STOCK02 and updated property name for consistency.
                stock02: spend[StoreName.STOCK02] || 0,
                wb: spend[StoreName.WB] || 0,
                due
            });
            previousDue = due;
        }

        return rows.reverse(); // Show most recent first
    }, [dailyKALIspend, topUps]);

    const formatCurrency = (amount: number) => amount === 0 ? '-' : amount.toFixed(2);

    return (
        <div className="flex flex-col flex-grow w-full">
            <div className="overflow-x-auto hide-scrollbar">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                        <tr>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Top Up</th>
                            {storesToTrack.map(store => (
                                <th key={store} scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{store}</th>
                            ))}
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Due</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {reportRows.map(row => (
                            <tr key={row.dateKey} className="hover:bg-gray-700/50">
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">
                                    {row.date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        defaultValue={row.topUp || ''}
                                        onBlur={(e) => handleTopUpChange(row.dateKey, e.target.value)}
                                        placeholder="-"
                                        className="bg-transparent p-1 w-24 rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">{formatCurrency(row.cv2)}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">{formatCurrency(row.shanti)}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">{formatCurrency(row.stock02)}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">{formatCurrency(row.wb)}</td>
                                <td className={`px-3 py-2 whitespace-nowrap text-sm font-semibold ${row.due < 0 ? 'text-red-400' : 'text-green-400'}`}>{formatCurrency(row.due)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DueReportSettings;