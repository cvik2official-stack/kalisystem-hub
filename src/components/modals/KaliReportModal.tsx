import React, { useState, useEffect, useMemo } from 'react';
import { generateKaliUnifyReport, getLatestItemPrice, getPhnomPenhDateKey } from '../../utils/messageFormatter';
import { Order, ItemPrice } from '../../types';

interface KaliReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (message: string) => void;
  isSending: boolean;
  orders: Order[];
  itemPrices: ItemPrice[];
}

const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDatesInRange = (start: Date, end: Date) => {
    const dates = [];
    let currentDate = new Date(start.toISOString().split('T')[0] + 'T00:00:00Z');
    const endDate = new Date(end.toISOString().split('T')[0] + 'T00:00:00Z');
    while (currentDate <= endDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
};


const KaliReportModal: React.FC<KaliReportModalProps> = ({ isOpen, onClose, onGenerate, isSending, orders, itemPrices }) => {
    const [startDate, setStartDate] = useState(formatDateForInput(new Date()));
    const [endDate, setEndDate] = useState(formatDateForInput(new Date()));
    const [manualInputs, setManualInputs] = useState<Record<string, { previousDue: string, topUp: string }>>({});
  
    useEffect(() => {
        if (!isOpen) {
            setStartDate(formatDateForInput(new Date()));
            setEndDate(formatDateForInput(new Date()));
            setManualInputs({});
        }
    }, [isOpen]);

    const handleManualInputChange = (dateKey: string, field: 'previousDue' | 'topUp', value: string) => {
        if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
            setManualInputs(prev => ({
                ...prev,
                [dateKey]: {
                    ...prev[dateKey],
                    [field]: value,
                }
            }));
        }
    };
    
    const { reportRows, fullReportMessage } = useMemo(() => {
        if (!isOpen) return { reportRows: [], fullReportMessage: '' };

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
            return { reportRows: [], fullReportMessage: 'Invalid date range.' };
        }

        const dates = getDatesInRange(start, end);
        const rows: any[] = [];
        let finalReport = '';
        let prevDayDue = 0;

        dates.forEach((date, index) => {
            const dateKey = formatDateForInput(date);

            const topUpVal = manualInputs[dateKey]?.topUp || '';
            const prevDueVal = index === 0 ? (manualInputs[dateKey]?.previousDue || '') : prevDayDue.toFixed(2);

            const ordersForDate = orders.filter(order => {
                if (!order.completedAt) return false;
                const completedDateKey = getPhnomPenhDateKey(order.completedAt);
                return completedDateKey === dateKey;
            });

            const calculateOrderTotal = (order: Order): number => {
                return order.items.reduce((total, item) => {
                    if (item.isSpoiled) return total;
                    const latestPrice = getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price ?? 0;
                    return total + ((item.price ?? latestPrice) * item.quantity);
                }, 0);
            };

            const totalSpend = ordersForDate.reduce((sum, order) => sum + calculateOrderTotal(order), 0);
            const prevDueNum = parseFloat(prevDueVal) || 0;
            const topUpNum = parseFloat(topUpVal) || 0;
            const totalDueNum = prevDueNum + totalSpend - topUpNum;

            rows.push({
                dateKey,
                isFirst: index === 0,
                previousDue: prevDueVal,
                topUp: topUpVal,
            });

            if (ordersForDate.length > 0 || topUpNum > 0 || (index === 0 && prevDueNum > 0)) {
                finalReport += generateKaliUnifyReport(ordersForDate, itemPrices, prevDueNum, topUpNum) + '\n\n';
            }
            prevDayDue = totalDueNum;
        });

        return { reportRows: rows, fullReportMessage: finalReport.trim() };
    }, [isOpen, startDate, endDate, manualInputs, orders, itemPrices]);


    const handleGenerateClick = () => {
        onGenerate(fullReportMessage);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
            <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg border-t-4 border-purple-500" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} disabled={isSending} className="absolute top-4 right-4 text-gray-400 hover:text-white disabled:text-gray-600" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h2 className="text-xl font-bold text-white mb-4">KALI Due Report</h2>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="report-date-start" className="block text-sm font-medium text-gray-300">Start Date</label>
                            <input
                                type="date"
                                id="report-date-start"
                                name="report-date-start"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                                disabled={isSending}
                            />
                        </div>
                        <div>
                            <label htmlFor="report-date-end" className="block text-sm font-medium text-gray-300">End Date</label>
                            <input
                                type="date"
                                id="report-date-end"
                                name="report-date-end"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                                disabled={isSending}
                            />
                        </div>
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 -mr-2">
                        {reportRows.map(row => (
                            <div key={row.dateKey} className="p-2 bg-gray-900/50 rounded-md">
                                <p className="text-xs font-semibold text-gray-400">{row.dateKey}</p>
                                <div className="grid grid-cols-2 gap-4 mt-1">
                                    <div>
                                        <label htmlFor={`previous-due-${row.dateKey}`} className="block text-xs font-medium text-gray-300">Previous Due</label>
                                        <input
                                            type="text"
                                            id={`previous-due-${row.dateKey}`}
                                            inputMode="decimal"
                                            value={row.previousDue}
                                            onChange={(e) => handleManualInputChange(row.dateKey, 'previousDue', e.target.value)}
                                            disabled={!row.isFirst || isSending}
                                            className="mt-1 w-full bg-gray-700 text-gray-200 rounded-md p-2 text-sm outline-none ring-1 ring-gray-600 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-800 disabled:text-gray-500"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor={`top-up-${row.dateKey}`} className="block text-xs font-medium text-gray-300">Top Up Amount</label>
                                        <input
                                            type="text"
                                            id={`top-up-${row.dateKey}`}
                                            inputMode="decimal"
                                            value={row.topUp}
                                            onChange={(e) => handleManualInputChange(row.dateKey, 'topUp', e.target.value)}
                                            autoFocus={row.isFirst}
                                            className="mt-1 w-full bg-gray-700 text-gray-200 rounded-md p-2 text-sm outline-none ring-1 ring-gray-600 focus:ring-2 focus:ring-indigo-500"
                                            disabled={isSending}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div>
                        <label htmlFor="report-preview" className="block text-sm font-medium text-gray-300">Preview</label>
                        <textarea
                            id="report-preview"
                            value={fullReportMessage}
                            readOnly
                            rows={8}
                            className="mt-1 w-full bg-gray-900 text-gray-300 rounded-md p-2 font-mono text-xs outline-none ring-1 ring-gray-700"
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button 
                        onClick={handleGenerateClick} 
                        disabled={isSending || !fullReportMessage}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-800 disabled:cursor-wait"
                    >
                        {isSending ? 'Sending...' : 'Send to Telegram'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KaliReportModal;