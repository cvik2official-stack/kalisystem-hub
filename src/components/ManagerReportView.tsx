import React, { useContext, useMemo, useState } from 'react';
import { Order, StoreName, OrderItem, Unit, PaymentMethod, OrderStatus, SupplierName } from '../types';
import { AppContext } from '../context/AppContext';
import { getLatestItemPrice } from '../utils/messageFormatter';

interface ReportOrderItem extends OrderItem {
    storeName: StoreName;
    paymentMethod?: PaymentMethod;
}

interface ManagerReportViewProps {
  storeName: StoreName | null; // Null for Smart View (all stores)
  orders: Order[];
  singleColumn?: 'on_the_way' | 'completed';
}

const ReportColumn: React.FC<{ 
    title: string; 
    orders: Order[]; 
    groupBy: 'supplier' | 'store';
}> = ({ title, orders, groupBy }) => {

    const { state, actions } = useContext(AppContext);
    const { itemPrices, suppliers } = state;
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(orders.map(o => groupBy === 'store' ? o.store : o.supplierName)));
    const [editingPriceUniqueId, setEditingPriceUniqueId] = useState<string | null>(null);

    const paymentMethodBadgeColors: Record<string, string> = {
        [PaymentMethod.ABA]: 'bg-blue-600/50 text-blue-200',
        [PaymentMethod.CASH]: 'bg-green-600/50 text-green-200',
        [PaymentMethod.KALI]: 'bg-purple-600/50 text-purple-200',
        [PaymentMethod.STOCK]: 'bg-gray-600/50 text-gray-200',
        [PaymentMethod.MISHA]: 'bg-orange-600/50 text-orange-200',
    };

    const toggleGroup = (groupKey: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupKey)) newSet.delete(groupKey);
            else newSet.add(groupKey);
            return newSet;
        });
    };

    const handleSaveInlinePrice = async (itemToUpdate: OrderItem, order: Order, totalPriceStr: string) => {
        setEditingPriceUniqueId(null);
        const newTotalPrice = totalPriceStr.trim() === '' ? null : parseFloat(totalPriceStr);

        if (newTotalPrice === null) {
            const { price, ...itemWithoutPrice } = itemToUpdate;
            if (itemToUpdate.price !== undefined) {
                await actions.updateOrder({ ...order, items: order.items.map(i => i.itemId === itemToUpdate.itemId ? itemWithoutPrice : i) });
            }
            return;
        }

        if (!isNaN(newTotalPrice) && newTotalPrice >= 0) {
            const newUnitPrice = itemToUpdate.quantity > 0 ? newTotalPrice / itemToUpdate.quantity : 0;
            const updatedItems = order.items.map(i =>
                (i.itemId === itemToUpdate.itemId && i.name === itemToUpdate.name) ? { ...i, price: newUnitPrice } : i
            );
            await actions.updateOrder({ ...order, items: updatedItems });
        }
    };

    const groupedOrders = useMemo(() => {
        const groups: Record<string, Order[]> = {};
        for (const order of orders) {
            const key = groupBy === 'store' ? order.store : order.supplierName;
            if (!groups[key]) groups[key] = [];
            groups[key].push(order);
        }
        return groups;
    }, [orders, groupBy]);
    
    return (
        <section className="flex flex-col bg-gray-900/50 rounded-lg h-full">
            <h2 className="text-lg font-semibold text-white p-3 flex-shrink-0">{title}</h2>
            <div className="flex-grow overflow-y-auto hide-scrollbar px-2 pb-2 space-y-2">
                {Object.keys(groupedOrders).length > 0 ? Object.keys(groupedOrders).sort().map(groupKey => {
                    const groupOrders = groupedOrders[groupKey];
                    const isExpanded = expandedGroups.has(groupKey);
                    
                    const groupTotal = groupOrders.reduce((total, order) => {
                        return total + order.items.reduce((orderTotal, item) => {
                             const latestPrice = getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price ?? 0;
                             return orderTotal + ((item.price ?? latestPrice) * item.quantity);
                        }, 0);
                    }, 0);

                    const firstOrder = groupOrders[0];
                    const supplier = suppliers.find(s => s.id === firstOrder.supplierId);
                    const paymentMethod = firstOrder.paymentMethod || supplier?.paymentMethod;

                    return (
                        <div key={groupKey} className="bg-gray-800 rounded-lg">
                            <button onClick={() => toggleGroup(groupKey)} className="w-full text-left p-2 flex justify-between items-center">
                                <div className="flex items-center space-x-2">
                                    <h3 className="font-bold text-white text-sm">{groupKey}</h3>
                                     {paymentMethod && (
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${paymentMethodBadgeColors[paymentMethod] || 'bg-gray-700'}`}>
                                            {paymentMethod.toUpperCase()} {groupTotal > 0 && groupTotal.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform transition-transform text-gray-400 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                            {isExpanded && (
                                <ul className="text-sm list-inside text-gray-300 px-2 pb-2 space-y-1">
                                    {groupOrders.flatMap(order => order.items.map((item, index) => {
                                        const uniqueId = `${item.itemId}-${groupKey}-${order.id}-${index}`;
                                        const latestPrice = getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price ?? 0;
                                        const itemTotal = (item.price ?? latestPrice) * item.quantity;
                                        const isEditingPrice = editingPriceUniqueId === uniqueId;

                                        const isStockIn = order.paymentMethod === PaymentMethod.STOCK;
                                        const isStockOut = order.supplierName === SupplierName.STOCK;
                                        const isStockMovement = isStockIn || isStockOut;

                                        return (
                                            <li key={uniqueId} className="flex justify-between items-center group md:list-item md:pl-4">
                                                <div className="flex-1 truncate">
                                                    <span className="md:hidden pr-2 text-gray-500">•</span>
                                                    <span className="pr-1">{item.name}</span>
                                                    <span className="text-xs text-gray-400">({order.store})</span>
                                                    <span className="text-gray-400 text-xs"> x{item.quantity}{item.unit}</span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {isStockMovement ? (
                                                        <div className="font-mono w-20 text-right p-1 -m-1 rounded-md">
                                                            {isStockOut ? <span className="font-semibold text-yellow-400">out</span> : <span className="font-semibold text-green-400">in</span>}
                                                        </div>
                                                    ) : (
                                                        isEditingPrice ? (
                                                            <input
                                                                type="text" inputMode="decimal" defaultValue={itemTotal > 0 ? itemTotal.toFixed(2) : ''}
                                                                autoFocus
                                                                onBlur={(e) => handleSaveInlinePrice(item, order, e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingPriceUniqueId(null); }}
                                                                className="bg-gray-700 text-cyan-300 font-mono rounded px-1 py-0.5 w-20 text-right outline-none ring-1 ring-indigo-500"
                                                            />
                                                        ) : (
                                                            <div onClick={() => setEditingPriceUniqueId(uniqueId)} className="font-mono text-cyan-300 w-20 text-right p-1 -m-1 rounded-md hover:bg-gray-700 cursor-pointer">
                                                                {itemTotal > 0 ? itemTotal.toFixed(2) : <span className="text-gray-500">-</span>}
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    }))}
                                </ul>
                            )}
                        </div>
                    )
                }) : <p className="text-center text-gray-500 py-12">No items to report.</p>}
            </div>
        </section>
    );
};

const ManagerReportView: React.FC<ManagerReportViewProps> = ({ storeName, orders, singleColumn }) => {
    
    const { onTheWayOrders, completedTodayOrders } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const onTheWay = orders.filter(o => o.status === OrderStatus.ON_THE_WAY);
        const completed = orders.filter(o => {
            if (o.status !== OrderStatus.COMPLETED || !o.completedAt) return false;
            const completedDate = new Date(o.completedAt);
            completedDate.setHours(0, 0, 0, 0);
            return completedDate.getTime() === today.getTime();
        });
        
        return { onTheWayOrders: onTheWay, completedTodayOrders: completed };
    }, [orders]);

    if (singleColumn) {
        if (singleColumn === 'on_the_way') {
            return <ReportColumn title="On the Way (Report)" orders={onTheWayOrders} groupBy="supplier" />;
        }
        if (singleColumn === 'completed') {
             return <ReportColumn title="Completed Today" orders={completedTodayOrders} groupBy="supplier" />;
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start h-full">
            <ReportColumn title="On the Way (Report)" orders={onTheWayOrders} groupBy={storeName ? 'supplier' : 'store'} />
            <ReportColumn title="Completed Today" orders={completedTodayOrders} groupBy="supplier" />
        </div>
    );
};

export default ManagerReportView;