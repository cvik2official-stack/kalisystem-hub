import React, { useContext, useMemo } from 'react';
import { Order, StoreName, OrderItem, Unit, PaymentMethod } from '../types';
import { AppContext } from '../context/AppContext';

interface AggregatedItem {
    name: string;
    quantity: number;
    unit?: Unit;
    totalValue: number;
}

const AggregatedItemList: React.FC<{ items: AggregatedItem[], showPrices: boolean, groupTotal: number }> = ({ items, showPrices, groupTotal }) => {
    if (items.length === 0) {
        return <p className="text-gray-500 text-sm py-2">No items in this group.</p>;
    }
    
    return (
        <div className="bg-gray-900/50 rounded-lg p-3">
             <div className="space-y-1">
                {items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                        <span className="text-gray-300 flex-1 truncate pr-2">{item.name}</span>
                        <div className="flex items-center space-x-4">
                            <span className="font-mono text-gray-400 w-16 text-right">{item.quantity}{item.unit}</span>
                            {showPrices && (
                                <span className="font-mono text-white w-20 text-right">${item.totalValue.toFixed(2)}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {showPrices && groupTotal > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700 flex justify-end">
                    <div className="flex items-center space-x-4">
                        <span className="font-semibold text-gray-300">Total:</span>
                        <span className="font-mono font-bold text-white w-20 text-right">${groupTotal.toFixed(2)}</span>
                    </div>
                </div>
            )}
        </div>
    )
};

interface ManagerReportViewProps {
  storeName: StoreName;
  orders: Order[];
}

const ManagerReportView: React.FC<ManagerReportViewProps> = ({ storeName, orders }) => {
    const { state } = useContext(AppContext);
    const { itemPrices, suppliers } = state;

    const processedData = useMemo(() => {
        if (storeName !== StoreName.SHANTI && storeName !== StoreName.WB) {
            return null;
        }

        const piseyOrders = orders.filter(o => o.supplierName.toUpperCase() === 'PISEY');
        const otherOrders = orders.filter(o => o.supplierName.toUpperCase() !== 'PISEY');

        const aggregate = (orderList: Order[]): AggregatedItem[] => {
            const itemMap = new Map<string, AggregatedItem>();

            for (const order of orderList) {
                for (const item of order.items) {
                    if (item.isSpoiled) continue;
                    
                    const key = `${item.itemId}-${item.unit || 'none'}`;
                    const masterPrice = itemPrices.find(p => p.itemId === item.itemId && p.supplierId === order.supplierId && p.isMaster)?.price;
                    const price = item.price ?? masterPrice ?? 0;
                    const value = price * item.quantity;
                    
                    const existing = itemMap.get(key);
                    if (existing) {
                        existing.quantity += item.quantity;
                        existing.totalValue += value;
                    } else {
                        itemMap.set(key, { name: item.name, quantity: item.quantity, unit: item.unit, totalValue: value });
                    }
                }
            }
            return Array.from(itemMap.values()).sort((a,b) => a.name.localeCompare(b.name));
        };

        const aggregatedPisey = aggregate(piseyOrders);
        const aggregatedKali = aggregate(otherOrders);

        const totalPisey = aggregatedPisey.reduce((sum, item) => sum + item.totalValue, 0);
        const totalKali = aggregatedKali.reduce((sum, item) => sum + item.totalValue, 0);

        return { aggregatedPisey, aggregatedKali, totalPisey, totalKali };

    }, [orders, storeName, itemPrices]);

    // For stores other than SHANTI and WB, render a simple list of orders.
    if (!processedData) {
        const paymentMethodBadgeColors: Record<string, string> = {
            [PaymentMethod.ABA]: 'bg-blue-500/50 text-blue-300',
            [PaymentMethod.CASH]: 'bg-green-500/50 text-green-300',
            [PaymentMethod.KALI]: 'bg-purple-500/50 text-purple-300',
            [PaymentMethod.STOCK]: 'bg-gray-500/50 text-gray-300',
        };

        return (
            <div className="space-y-2">
                {orders.length > 0 ? orders.map(order => {
                    const supplier = suppliers.find(s => s.id === order.supplierId);
                    const displayPaymentMethod = order.paymentMethod || supplier?.paymentMethod;

                    return (
                        <div key={order.id} className="bg-gray-800 p-2 rounded-lg">
                            <div className="flex items-center space-x-2">
                                <h3 className="font-bold text-white">{order.supplierName}</h3>
                                {displayPaymentMethod && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${paymentMethodBadgeColors[displayPaymentMethod] || 'bg-gray-500/50 text-gray-300'}`}>
                                        {displayPaymentMethod.toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <ul className="text-sm list-disc list-inside mt-1 text-gray-300">
                               {order.items.map(item => <li key={item.itemId}>{item.name} x {item.quantity}{item.unit}</li>)}
                            </ul>
                        </div>
                    );
                }) : <p className="text-center text-gray-500">No orders to display.</p>}
            </div>
        );
    }
    
    const showPrices = storeName === StoreName.SHANTI;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h2 className="text-lg font-bold text-white mb-2">PISEY</h2>
                <AggregatedItemList items={processedData.aggregatedPisey} showPrices={showPrices} groupTotal={processedData.totalPisey} />
            </div>

            <div>
                <h2 className="text-lg font-bold text-white mb-2">KALI</h2>
                 <AggregatedItemList items={processedData.aggregatedKali} showPrices={showPrices} groupTotal={processedData.totalKali} />
            </div>
        </div>
    );
};

export default ManagerReportView;