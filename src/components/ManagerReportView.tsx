import React, { useContext, useMemo, useState } from 'react';
import { Order, StoreName, OrderItem, Unit, PaymentMethod, OrderStatus, SupplierName, Supplier } from '../types';
import { AppContext } from '../context/AppContext';
import { getLatestItemPrice } from '../utils/messageFormatter';

// FIX: Define the props interface for the component.
interface ManagerReportViewProps {
    storeName: StoreName | null;
    orders: Order[];
    singleColumn?: 'dispatch' | 'on_the_way' | 'completed';
}

const ReportColumn: React.FC<{ 
    title: string; 
    orders: Order[]; 
}> = ({ title, orders }) => {

    const { state, actions } = useContext(AppContext);
    const { itemPrices, suppliers } = state;
    const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set(orders.map(o => o.store)));
    const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set(orders.map(o => `${o.store}-${o.supplierName}`)));
    const [editingPriceUniqueId, setEditingPriceUniqueId] = useState<string | null>(null);

    const paymentMethodBadgeColors: Record<string, string> = {
        [PaymentMethod.ABA]: 'bg-blue-600/50 text-blue-200',
        [PaymentMethod.CASH]: 'bg-green-600/50 text-green-200',
        [PaymentMethod.KALI]: 'bg-purple-600/50 text-purple-200',
        [PaymentMethod.STOCK]: 'bg-gray-600/50 text-gray-200',
        [PaymentMethod.MISHA]: 'bg-orange-600/50 text-orange-200',
    };

    const toggleStore = (storeName: string) => {
        setExpandedStores(prev => {
            const newSet = new Set(prev);
            if (newSet.has(storeName)) newSet.delete(storeName);
            else newSet.add(storeName);
            return newSet;
        });
    };
    
    const toggleSupplier = (supplierKey: string) => {
        setExpandedSuppliers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(supplierKey)) newSet.delete(supplierKey);
            else newSet.add(supplierKey);
            return newSet;
        });
    };

    const handleSaveInlinePrice = async (itemToUpdate: OrderItem, order: Order, totalPriceStr: string) => {
        setEditingPriceUniqueId(null);
        let newTotalPrice = totalPriceStr.trim() === '' ? null : parseFloat(totalPriceStr);

        if (newTotalPrice !== null && newTotalPrice > 1000) {
            newTotalPrice = newTotalPrice / 4000;
        }

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

    const groupedByStore = useMemo(() => {
        const groups: Record<string, Record<string, Order[]>> = {};
        for (const order of orders) {
            if (!groups[order.store]) groups[order.store] = {};
            if (!groups[order.store][order.supplierName]) groups[order.store][order.supplierName] = [];
            groups[order.store][order.supplierName].push(order);
        }
        return groups;
    }, [orders]);
    
    return (
        <section className="flex flex-col bg-gray-900/50 rounded-lg h-full">
            <h2 className="text-lg font-semibold text-white p-3 flex-shrink-0">{title}</h2>
            <div className="flex-grow overflow-y-auto hide-scrollbar px-2 pb-2 space-y-2">
                {Object.keys(groupedByStore).length > 0 ? Object.keys(groupedByStore).sort().map(storeName => {
                    const storeGroups = groupedByStore[storeName as StoreName];
                    const isStoreExpanded = expandedStores.has(storeName);
                    return (
                        <div key={storeName} className="bg-gray-800/50 rounded-lg">
                            <button onClick={() => toggleStore(storeName)} className="w-full text-left p-2 flex justify-between items-center bg-gray-800 rounded-t-lg">
                                <h3 className="font-bold text-white text-base">{storeName}</h3>
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-400 ${isStoreExpanded ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                            {isStoreExpanded && (
                                <div className="p-2 space-y-2">
                                {Object.keys(storeGroups).sort().map(supplierName => {
                                    const supplierOrders = storeGroups[supplierName as SupplierName];
                                    const supplierKey = `${storeName}-${supplierName}`;
                                    const isSupplierExpanded = expandedSuppliers.has(supplierKey);

                                    const groupTotal = supplierOrders.reduce((total, order) => {
                                        return total + order.items.reduce((orderTotal, item) => {
                                            const latestPrice = getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price ?? 0;
                                            return orderTotal + ((item.price ?? latestPrice) * item.quantity);
                                        }, 0);
                                    }, 0);

                                    const firstOrder = supplierOrders[0];
                                    const supplier = suppliers.find(s => s.id === firstOrder.supplierId);
                                    const paymentMethod = firstOrder.paymentMethod || supplier?.paymentMethod;

                                    return (
                                        <div key={supplierKey} className="bg-gray-800 rounded-lg">
                                            <button onClick={() => toggleSupplier(supplierKey)} className="w-full text-left p-2 flex justify-between items-center">
                                                <div className="flex items-center space-x-2">
                                                    <h4 className="font-semibold text-gray-200 text-sm">{supplierName}</h4>
                                                    {paymentMethod && (
                                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${paymentMethodBadgeColors[paymentMethod] || 'bg-gray-700'}`}>
                                                            {paymentMethod.toUpperCase()} {groupTotal > 0 && groupTotal.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform transition-transform text-gray-400 ${isSupplierExpanded ? 'rotate-180' : 'rotate-0'}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                            </button>
                                            {isSupplierExpanded && (
                                                <ul className="text-sm list-inside text-gray-300 px-2 pb-2 space-y-1">
                                                    {supplierOrders.flatMap(order => order.items.map((item, index) => {
                                                        const uniqueId = `${item.itemId}-${supplierKey}-${order.id}-${index}`;
                                                        const latestPrice = getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price ?? 0;
                                                        const itemTotal = (item.price ?? latestPrice) * item.quantity;
                                                        const isEditingPrice = editingPriceUniqueId === uniqueId;

                                                        const isStockIn = order.paymentMethod === PaymentMethod.STOCK;
                                                        const isStockOut = order.supplierName === SupplierName.STOCK;
                                                        const isStockMovement = isStockIn || isStockOut;

                                                        return (
                                                            <li key={uniqueId} className="flex justify-between items-center group">
                                                                <div className="flex-1 truncate">
                                                                    <span className="hidden md:inline pr-2 text-gray-500">•</span>
                                                                    <span className="pr-1">{item.name}</span>
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
                                })}
                                </div>
                            )}
                        </div>
                    )
                }) : <p className="text-center text-gray-500 py-12">No items to report.</p>}
            </div>
        </section>
    );
};

const ManagerReportView: React.FC<ManagerReportViewProps> = ({ storeName, orders, singleColumn }) => {
    
    const { onTheWayOrders, completedTodayOrders, dispatchingOrders } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const onTheWay = orders.filter(o => o.status === OrderStatus.ON_THE_WAY);
        const completed = orders.filter(o => {
            if (o.status !== OrderStatus.COMPLETED || !o.completedAt) return false;
            const completedDate = new Date(o.completedAt);
            completedDate.setHours(0, 0, 0, 0);
            return completedDate.getTime() === today.getTime();
        });
        const dispatching = orders.filter(o => o.status === OrderStatus.DISPATCHING);
        
        return { onTheWayOrders: onTheWay, completedTodayOrders: completed, dispatchingOrders: dispatching };
    }, [orders]);

    if (singleColumn) {
        if (singleColumn === 'dispatch') {
            return <ReportColumn title="Dispatch" orders={dispatchingOrders} />;
        }
        if (singleColumn === 'on_the_way') {
            return <ReportColumn title="On the Way" orders={onTheWayOrders} />;
        }
        if (singleColumn === 'completed') {
             return <ReportColumn title="Completed" orders={completedTodayOrders} />;
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start h-full">
            <ReportColumn title="On the Way" orders={onTheWayOrders} />
            <ReportColumn title="Completed" orders={completedTodayOrders} />
        </div>
    );
};

export default ManagerReportView;