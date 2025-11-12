import React, { useContext, useMemo, useState } from 'react';
import { Order, StoreName, OrderItem, Unit, PaymentMethod, OrderStatus, SupplierName } from '../types';
import { AppContext } from '../context/AppContext';

interface AggregatedItem {
    name: string;
    quantity: number;
    unit?: Unit;
    totalValue?: number; // Optional for views that hide prices
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
                            {showPrices && item.totalValue != null && (
                                <span className="font-mono text-white w-20 text-right">{item.totalValue.toFixed(2)}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {showPrices && groupTotal > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700 flex justify-end">
                    <div className="flex items-center space-x-4">
                        <span className="font-semibold text-gray-300">Total:</span>
                        <span className="font-mono font-bold text-white w-20 text-right">{groupTotal.toFixed(2)}</span>
                    </div>
                </div>
            )}
        </div>
    )
};

// --- KALI MANAGER VIEW SPECIFIC COMPONENTS ---

interface KaliSupplierData {
    orders: Order[];
    itemsByStore: Map<StoreName, AggregatedItem[]>;
}

const KaliSupplierCard: React.FC<{
    supplierName: SupplierName;
    data: KaliSupplierData;
    onToggle: (supplierName: SupplierName, orders: Order[]) => void;
    isChecked: boolean;
}> = ({ supplierName, data, onToggle, isChecked }) => {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleToggle = async () => {
        setIsProcessing(true);
        try {
            await onToggle(supplierName, data.orders);
        } finally {
            setIsProcessing(false);
        }
    };

    const hasSingleStore = data.itemsByStore.size === 1;
    const singleStoreName = hasSingleStore ? Array.from(data.itemsByStore.keys())[0] : null;

    return (
        <div className="bg-gray-800 p-2 rounded-lg">
            <label className="flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={handleToggle}
                    disabled={isProcessing}
                    className="h-5 w-5 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                />
                <h3 className="ml-3 font-bold text-white flex items-center space-x-2">
                    <span>{supplierName}</span>
                    {hasSingleStore && <span className="text-sm font-semibold text-gray-400">{singleStoreName}</span>}
                </h3>
                {isProcessing && <svg className="animate-spin h-4 w-4 text-white ml-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
            </label>
            <div className="mt-2 pl-8 space-y-1">
                {Array.from(data.itemsByStore.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([storeName, items]) => (
                    <div key={storeName}>
                        {!hasSingleStore && <h4 className="text-sm font-semibold text-gray-400">{storeName}</h4>}
                        <div className={!hasSingleStore ? "pl-4 mt-1" : ""}>
                            {items.map((item, index) => (
                                <div key={index} className="flex justify-between items-center text-sm leading-tight">
                                    <span className="text-gray-300 flex-1 truncate pr-2">{item.name}</span>
                                    <span className="font-mono text-gray-400 w-16 text-right">{item.quantity}{item.unit}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

interface ManagerReportViewProps {
  storeName: StoreName;
  orders: Order[];
}

const ManagerReportView: React.FC<ManagerReportViewProps> = ({ storeName, orders }) => {
    const { state, actions } = useContext(AppContext);
    const { itemPrices, suppliers } = state;

    const processedData = useMemo(() => {
        if (storeName !== StoreName.SHANTI && storeName !== StoreName.WB) {
            return null;
        }

        const piseyOrders = orders.filter(o => o.supplierName === SupplierName.PISEY);
        const otherOrders = orders.filter(o => o.supplierName !== SupplierName.PISEY);

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
                        existing.totalValue = (existing.totalValue ?? 0) + value;
                    } else {
                        itemMap.set(key, { name: item.name, quantity: item.quantity, unit: item.unit, totalValue: value });
                    }
                }
            }
            return Array.from(itemMap.values()).sort((a,b) => a.name.localeCompare(b.name));
        };

        const aggregatedPisey = aggregate(piseyOrders);
        const aggregatedKali = aggregate(otherOrders);

        const totalPisey = aggregatedPisey.reduce((sum, item) => sum + (item.totalValue ?? 0), 0);
        const totalKali = aggregatedKali.reduce((sum, item) => sum + (item.totalValue ?? 0), 0);

        return { aggregatedPisey, aggregatedKali, totalPisey, totalKali };

    }, [orders, storeName, itemPrices]);
    
    if (storeName === StoreName.KALI) {
        const { todoBySupplier, pickedUpBySupplier } = useMemo(() => {
            const todo = new Map<SupplierName, KaliSupplierData>();
            const pickedUp = new Map<SupplierName, KaliSupplierData>();

            const aggregateAndGroup = (order: Order, map: Map<SupplierName, KaliSupplierData>) => {
                if (!map.has(order.supplierName)) {
                    map.set(order.supplierName, { orders: [], itemsByStore: new Map() });
                }
                const supplierData = map.get(order.supplierName)!;
                supplierData.orders.push(order);

                const storeItemsMap = new Map<string, AggregatedItem>();
                
                const existingStoreItems = supplierData.itemsByStore.get(order.store) || [];
                existingStoreItems.forEach(item => {
                    const key = `${item.name}-${item.unit || 'none'}`;
                    storeItemsMap.set(key, {...item});
                });

                for (const item of order.items) {
                    if (item.isSpoiled) continue;
                    const key = `${item.name}-${item.unit || 'none'}`;
                    const existing = storeItemsMap.get(key);
                    if (existing) {
                        existing.quantity += item.quantity;
                    } else {
                        storeItemsMap.set(key, { name: item.name, quantity: item.quantity, unit: item.unit });
                    }
                }
                
                const sortedStoreItems = Array.from(storeItemsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
                supplierData.itemsByStore.set(order.store, sortedStoreItems);
            };

            for (const order of orders) {
                if (order.status === OrderStatus.ON_THE_WAY) {
                    aggregateAndGroup(order, todo);
                } else if (order.status === OrderStatus.COMPLETED) {
                    aggregateAndGroup(order, pickedUp);
                }
            }
            
            return { todoBySupplier: todo, pickedUpBySupplier: pickedUp };
        }, [orders]);
        
        const handleToggleTodo = async (supplier: SupplierName, ordersToUpdate: Order[]) => {
            const updates = ordersToUpdate.map(order => 
                actions.updateOrder({ ...order, status: OrderStatus.COMPLETED, completedAt: new Date().toISOString() })
            );
            await Promise.all(updates);
        };
        
        const handleTogglePickedUp = async (supplier: SupplierName, ordersToUpdate: Order[]) => {
            const updates = ordersToUpdate.map(order => {
                const { completedAt, ...rest } = order;
                return actions.updateOrder({ ...rest, status: OrderStatus.ON_THE_WAY });
            });
            await Promise.all(updates);
        };
        
        // FIX: Explicitly type sort callback parameters to fix type inference issue where they were inferred as 'unknown'.
        const sortedTodoSuppliers = Array.from(todoBySupplier.keys()).sort((a: SupplierName, b: SupplierName) => a.localeCompare(b));
        const sortedPickedUpSuppliers = Array.from(pickedUpBySupplier.keys()).sort((a: SupplierName, b: SupplierName) => a.localeCompare(b));

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="space-y-3">
                    <h2 className="text-lg font-bold text-white sticky top-0 bg-gray-900 py-1 px-2 -mx-2 rounded-t-lg z-10">To Do ({sortedTodoSuppliers.length})</h2>
                    {sortedTodoSuppliers.map(supplierName => (
                        <KaliSupplierCard 
                            key={supplierName}
                            supplierName={supplierName}
                            data={todoBySupplier.get(supplierName)!}
                            onToggle={handleToggleTodo}
                            isChecked={false}
                        />
                    ))}
                    {sortedTodoSuppliers.length === 0 && <p className="text-gray-500 text-center pt-8">All orders picked up.</p>}
                </div>
                 <div className="space-y-3">
                    <h2 className="text-lg font-bold text-white sticky top-0 bg-gray-900 py-1 px-2 -mx-2 rounded-t-lg z-10">Picked Up ({sortedPickedUpSuppliers.length})</h2>
                    {sortedPickedUpSuppliers.map(supplierName => (
                         <KaliSupplierCard 
                            key={supplierName}
                            supplierName={supplierName}
                            data={pickedUpBySupplier.get(supplierName)!}
                            onToggle={handleTogglePickedUp}
                            isChecked={true}
                        />
                    ))}
                     {sortedPickedUpSuppliers.length === 0 && <p className="text-gray-500 text-center pt-8">No orders picked up yet.</p>}
                </div>
            </div>
        );
    }

    // For stores other than SHANTI, WB, and KALI render a simple list of orders.
    if (!processedData) {
        const paymentMethodBadgeColors: Record<string, string> = {
            [PaymentMethod.ABA]: 'bg-blue-500/50 text-blue-300',
            [PaymentMethod.CASH]: 'bg-green-500/50 text-green-300',
            [PaymentMethod.KALI]: 'bg-purple-500/50 text-purple-300',
            [PaymentMethod.STOCK]: 'bg-gray-500/50 text-gray-300',
            [PaymentMethod.MISHA]: 'bg-orange-500/50 text-orange-300',
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