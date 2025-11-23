import React, { useContext, useMemo, useState } from 'react';
import { Order, OrderItem, OrderStatus, Unit, PaymentMethod, Supplier, Item } from '../types';
import { AppContext } from '../context/AppContext';
import { generateOrderMessage, getLocalDateKey } from '../utils/messageFormatter';
import { sendOrderToSupplierOnTelegram } from '../services/telegramService';
import { useNotifier } from '../context/NotificationContext';
import { formatDateGroupHeader } from '../utils/dateUtils';
import ManagerOrderRow from './ManagerOrderRow';

import NumpadModal from './modals/NumpadModal';
import PaymentMethodModal from './modals/PaymentMethodModal';
import AddItemModal from './modals/AddItemModal';
import AddSupplierModal from './modals/AddSupplierModal';
import PasteItemsModal from './modals/PasteItemsModal';
import PriceNumpadModal from './modals/PriceNumpadModal';

interface ManagerReportViewProps {
    orders: Order[];
    singleColumn?: 'dispatch' | 'on_the_way' | 'completed';
    onItemDrop: (destinationOrderId: string) => void;
    hideTitle?: boolean;
    showStoreName?: boolean;
}

const ManagerReportView: React.FC<ManagerReportViewProps> = (props) => {
    const { state, dispatch, actions } = useContext(AppContext);
    const { suppliers, itemPrices, draggedItem } = state;
    const { notify } = useNotifier();
    const { orders, singleColumn, onItemDrop, hideTitle, showStoreName } = props;
    
    // Global Modal States
    const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
    const [numpadItem, setNumpadItem] = useState<{ order: Order, item: OrderItem } | null>(null);
    const [priceNumpadItem, setPriceNumpadItem] = useState<{ order: Order, item: OrderItem } | null>(null);
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
    const [orderForAddItem, setOrderForAddItem] = useState<Order | null>(null);
    const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
    const [isPasteItemsModalOpen, setIsPasteItemsModalOpen] = useState(false);
    
    const [isChangeSupplierModalOpen, setIsChangeSupplierModalOpen] = useState(false);
    const [orderToChangeSupplier, setOrderToChangeSupplier] = useState<Order | null>(null);

    // Derived Data
    const columnOrders = useMemo(() => {
        if (!singleColumn) return orders;
        const statusMap = { 'dispatch': OrderStatus.DISPATCHING, 'on_the_way': OrderStatus.ON_THE_WAY, 'completed': OrderStatus.COMPLETED };
        const status = statusMap[singleColumn];
        return orders.filter(o => o.status === status);
    }, [orders, singleColumn]);
    
    const groupedCompletedOrders = useMemo(() => {
        if (singleColumn !== 'completed') return {};
        
        const groups: Record<string, Order[]> = {};
        const todayKey = getLocalDateKey();
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayKey = getLocalDateKey(yesterdayDate);
        
        columnOrders.forEach(order => {
            const completedDateKey = getLocalDateKey(order.completedAt);
            const key = completedDateKey === todayKey ? 'Today' : completedDateKey;
            if (!groups[key]) groups[key] = [];
            groups[key].push(order);
        });

        if (!groups['Today']) groups['Today'] = [];
        if (!groups[yesterdayKey]) groups[yesterdayKey] = [];
        
        return groups;
    }, [columnOrders, singleColumn]);

    const sortedCompletedGroupKeys = useMemo(() => {
        if (singleColumn !== 'completed') return [];
        return Object.keys(groupedCompletedOrders).sort((a, b) => {
            if (a === 'Today') return -1;
            if (b === 'Today') return 1;
            return new Date(b).getTime() - new Date(a).getTime();
        });
    }, [groupedCompletedOrders, singleColumn]);

    // Expansion States
    const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set(columnOrders.map(o => o.store)));
    const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(() => {
        return new Set(columnOrders.filter(o => o.status !== OrderStatus.COMPLETED).map(o => o.id));
    });
    const [expandedDateGroups, setExpandedDateGroups] = useState<Set<string>>(new Set(['Today']));

    const groupedByStore = useMemo(() => {
        const storeGroups: Record<string, Order[]> = {};
        columnOrders.forEach(order => {
            if (!storeGroups[order.store]) storeGroups[order.store] = [];
            storeGroups[order.store].push(order);
        });
        return storeGroups;
    }, [columnOrders]);
    
    const sortedStoreNames = useMemo(() => Object.keys(groupedByStore).sort((a, b) => a.localeCompare(b)), [groupedByStore]);

    // Handlers
    const toggleStore = (storeName: string) => setExpandedStores(prev => { const newSet = new Set(prev); if (newSet.has(storeName)) newSet.delete(storeName); else newSet.add(storeName); return newSet; });
    const toggleSupplier = (orderId: string) => setExpandedSuppliers(prev => { const newSet = new Set(prev); if (newSet.has(orderId)) newSet.delete(orderId); else newSet.add(orderId); return newSet; });
    const toggleDateGroup = (dateKey: string) => setExpandedDateGroups(prev => { const newSet = new Set(prev); if (newSet.has(dateKey)) newSet.delete(dateKey); else newSet.add(dateKey); return newSet; });

    const handleItemDragStart = (e: React.DragEvent, item: OrderItem, sourceOrderId: string) => {
        e.stopPropagation();
        dispatch({ type: 'SET_DRAGGED_ITEM', payload: { item, sourceOrderId } });
    };
    
    const handleDropOnSupplier = (e: React.DragEvent, destinationOrderId: string) => {
        e.preventDefault(); e.stopPropagation();
        if (draggedItem) onItemDrop(destinationOrderId);
    };

    const handleSendToTelegram = async (order: Order) => {
        const { settings, suppliers: allSuppliers, stores } = state;
        const currentSupplier = allSuppliers.find(s => s.id === order.supplierId);
        if (!currentSupplier || !currentSupplier.chatId || !settings.telegramBotToken) { notify('Supplier Chat ID or Bot Token is not configured.', 'error'); return; }
        try {
            await sendOrderToSupplierOnTelegram(order, currentSupplier, generateOrderMessage(order, 'html', allSuppliers, stores, settings), settings.telegramBotToken);
            notify(`Order sent to ${order.supplierName}.`, 'success');
            if (order.status === OrderStatus.DISPATCHING) {
                await actions.updateOrder({ ...order, isSent: true, status: OrderStatus.ON_THE_WAY });
            }
        } catch (error: any) {
            notify(error.message || `Failed to send.`, 'error');
        }
    };

    const handleQuantityClick = (order: Order, item: OrderItem) => setNumpadItem({ order, item });

    const handleSwitchToPriceFromNumpad = () => {
        if (numpadItem) {
            const itemRef = { ...numpadItem };
            setNumpadItem(null);
            setTimeout(() => setPriceNumpadItem(itemRef), 50);
        }
    };

    const handleSaveItemQuantity = async (quantity: number, unit?: Unit) => {
        if (!numpadItem) return;
        const { order, item } = numpadItem;
        const newItems = order.items.map(i => (i.itemId === item.itemId && i.isSpoiled === item.isSpoiled) ? { ...i, quantity, unit: unit || i.unit } : i);
        await actions.updateOrder({ ...order, items: newItems });
        setNumpadItem(null);
    };

    const handleDeleteItem = async () => {
        if (!numpadItem) return;
        const { order, item } = numpadItem;
        const newItems = order.items.filter(i => !(i.itemId === item.itemId && i.isSpoiled === item.isSpoiled));
        await actions.updateOrder({ ...order, items: newItems });
        setNumpadItem(null);
    };
    
    const handleSavePriceFromModal = async (price: number, unit: Unit) => {
        if (!priceNumpadItem) return;
        const { order, item } = priceNumpadItem;
        
        const existingMaster = itemPrices.find(p => p.itemId === item.itemId && p.supplierId === order.supplierId && p.unit === unit);

        if (!existingMaster) {
            await actions.upsertItemPrice({ itemId: item.itemId, supplierId: order.supplierId, price: price, unit: unit });
            const updatedItems = order.items.map(i => (i.itemId === item.itemId && i.isSpoiled === item.isSpoiled) ? { ...i, quantity: i.quantity, unit: unit, price: undefined } : i);
            await actions.updateOrder({ ...order, items: updatedItems });
            notify('Price set as default.', 'success');
        } else {
            const updatedItems = order.items.map(i => (i.itemId === item.itemId && i.isSpoiled === item.isSpoiled) ? { ...i, price, unit } : i);
            await actions.updateOrder({ ...order, items: updatedItems });
        }
        setPriceNumpadItem(null);
    };

    const handlePaymentMethodSelect = async (method: PaymentMethod) => {
        if (paymentModalOrder) {
            await actions.updateOrder({ ...paymentModalOrder, paymentMethod: method });
            setPaymentModalOrder(null);
        }
    };

    const handleAddItemFromModal = async (item: Item) => {
        if (!orderForAddItem) return;
        const existingItemIndex = orderForAddItem.items.findIndex(i => i.itemId === item.id && !i.isSpoiled);
        let newItems;
        if (existingItemIndex > -1) {
            newItems = [...orderForAddItem.items];
            newItems[existingItemIndex] = { ...newItems[existingItemIndex], quantity: newItems[existingItemIndex].quantity + 1 };
        } else {
            const newItem: OrderItem = { itemId: item.id, name: item.name, quantity: 1, unit: item.unit, isNew: orderForAddItem.status === OrderStatus.ON_THE_WAY };
            newItems = [...orderForAddItem.items, newItem];
        }
        await actions.updateOrder({ ...orderForAddItem, items: newItems });
        notify(`Added ${item.name}`, 'success');
    };

    const handleAddSupplier = async (supplier: Supplier) => {
        if (state.activeStore === 'Settings' || state.activeStore === 'ALL' || !state.activeStore) return;
        await actions.addOrder(supplier, state.activeStore, [], OrderStatus.DISPATCHING);
        setIsAddSupplierModalOpen(false);
    };
    
    const handleChangeSupplier = async (newSupplier: Supplier) => {
        if (!orderToChangeSupplier) return;
        let supplierToUse = newSupplier;
        if (newSupplier.id.startsWith('new_')) {
            const newSupplierFromDb = await actions.addSupplier({ name: newSupplier.name });
            supplierToUse = newSupplierFromDb;
        }
        await actions.updateOrder({ ...orderToChangeSupplier, supplierId: supplierToUse.id, supplierName: supplierToUse.name, paymentMethod: supplierToUse.paymentMethod });
        setOrderToChangeSupplier(null);
        setIsChangeSupplierModalOpen(false);
    };

    const sortOrders = (orders: Order[]) => {
        return orders.sort((a, b) => {
            const nameA = a.supplierName; const nameB = b.supplierName;
            if (nameA === 'PISEY' && nameB !== 'PISEY') return 1; if (nameB === 'PISEY' && nameA !== 'PISEY') return -1;
            const indexA = ['KALI', 'STOCK'].indexOf(nameA); const indexB = ['KALI', 'STOCK'].indexOf(nameB);
            if (indexA > -1 && indexB > -1) return indexA - indexB; if (indexA > -1) return -1; if (indexB > -1) return 1;
            return nameA.localeCompare(nameB);
        });
    };

    const title = singleColumn ? singleColumn.replace(/_/g, ' ') : '';

    return (
        <>
        <div className="outline-none h-full flex flex-col">
            {!hideTitle && (
                <h2 className="capitalize text-lg font-medium px-1 py-2 flex items-center space-x-2 text-gray-400">
                    <span>{title}</span>
                    {singleColumn === 'dispatch' && state.activeStore !== 'ALL' && state.activeStore !== 'Settings' && (
                        <div className="flex items-center space-x-1">
                             <button onClick={() => setIsAddSupplierModalOpen(true)} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" title="New Card">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                             </button>
                             <button onClick={() => setIsPasteItemsModalOpen(true)} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" title="Paste List">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                             </button>
                        </div>
                    )}
                </h2>
            )}
            
            <div className="space-y-1 flex-grow pr-2 -mr-2 overflow-y-auto hide-scrollbar">
                {singleColumn === 'dispatch' && state.activeStore !== 'ALL' && state.activeStore !== 'Settings' && (
                    <div className="space-y-2 p-2 bg-gray-900/50 rounded-md mb-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{state.activeStore}</h4>
                        <div className="flex flex-col items-center justify-center space-y-2 w-full">
                            <button onClick={() => setIsAddSupplierModalOpen(true)} className="text-indigo-400 hover:text-indigo-300 hover:bg-gray-700/50 font-semibold transition-colors text-sm py-1 px-2 rounded w-full text-left">
                                + Select Supplier
                            </button>
                            <button onClick={() => setIsPasteItemsModalOpen(true)} className="text-indigo-400 hover:text-indigo-300 hover:bg-gray-700/50 font-semibold transition-colors text-sm py-1 px-2 rounded w-full text-left">
                                Paste a List
                            </button>
                        </div>
                    </div>
                )}

                {singleColumn === 'completed' ? (
                        <>
                            {sortedCompletedGroupKeys.map(key => {
                                const ordersInDateGroup = groupedCompletedOrders[key] || [];
                                const isDateExpanded = expandedDateGroups.has(key);
                                
                                if (ordersInDateGroup.length === 0 && formatDateGroupHeader(key) !== 'Today' && formatDateGroupHeader(key) !== 'Yesterday') return null;

                                return (
                                    <div key={key}>
                                        <button 
                                            onClick={() => toggleDateGroup(key)}
                                            className="w-full flex items-center text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 mt-1 pl-1 hover:text-white transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 transform transition-transform ${isDateExpanded ? 'rotate-0' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                            {formatDateGroupHeader(key)}
                                        </button>
                                        {isDateExpanded && (
                                            <div className="space-y-3 mb-6 ml-2">
                                                {(() => {
                                                    const ordersByStore = ordersInDateGroup.reduce((acc, order) => {
                                                        if (!acc[order.store]) acc[order.store] = [];
                                                        acc[order.store].push(order);
                                                        return acc;
                                                    }, {} as Record<string, Order[]>);
                                                    const sortedStoresInGroup = Object.keys(ordersByStore).sort();
                                                    
                                                    if (ordersInDateGroup.length === 0) return <div className="text-gray-600 text-xs pl-2 italic">No completed orders.</div>;

                                                    return sortedStoresInGroup.map(storeName => (
                                                        <div key={storeName}>
                                                            <h4 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1 pl-1">{storeName}</h4>
                                                            <div className="space-y-1 pl-2 border-l-2 border-gray-700/50">
                                                                {sortOrders(ordersByStore[storeName]).map(order => (
                                                                    <ManagerOrderRow
                                                                        key={order.id}
                                                                        order={order}
                                                                        suppliers={suppliers}
                                                                        itemPrices={itemPrices}
                                                                        showStoreName={false}
                                                                        isExpanded={expandedSuppliers.has(order.id)}
                                                                        onToggleExpand={() => toggleSupplier(order.id)}
                                                                        onUpdateOrder={actions.updateOrder}
                                                                        onDeleteOrder={actions.deleteOrder}
                                                                        onChangeSupplier={(o) => { setOrderToChangeSupplier(o); setIsChangeSupplierModalOpen(true); }}
                                                                        onItemDrop={handleDropOnSupplier}
                                                                        onDragItemStart={handleItemDragStart}
                                                                        onQuantityClick={handleQuantityClick}
                                                                        onSendTelegram={handleSendToTelegram}
                                                                        onAddModalOpen={(o) => { setOrderForAddItem(o); setIsAddItemModalOpen(true); }}
                                                                        onPaymentClick={(o) => { setPaymentModalOrder(o); }}
                                                                        singleColumn={singleColumn}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </>
                    ) : (
                    sortedStoreNames.map(storeName => {
                        const isStoreExpanded = expandedStores.has(storeName);
                        const storeOrders = sortOrders(groupedByStore[storeName] || []);
                        if (storeOrders.length === 0) return null;

                        return (
                            <div key={storeName}>
                                <button onClick={() => toggleStore(storeName)} className="flex items-center w-full text-left py-1 hover:bg-gray-800/50 rounded">
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-white mr-1 transform transition-transform ${isStoreExpanded ? 'rotate-0' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    <h3 className="font-bold text-white text-xs uppercase">{storeName}</h3>
                                </button>
                                {isStoreExpanded && (
                                    <div className="space-y-1 pl-2 mt-1">
                                        {storeOrders.map(order => (
                                            <ManagerOrderRow
                                                key={order.id}
                                                order={order}
                                                suppliers={suppliers}
                                                itemPrices={itemPrices}
                                                showStoreName={false}
                                                isExpanded={expandedSuppliers.has(order.id)}
                                                onToggleExpand={() => toggleSupplier(order.id)}
                                                onUpdateOrder={actions.updateOrder}
                                                onDeleteOrder={actions.deleteOrder}
                                                onChangeSupplier={(o) => { setOrderToChangeSupplier(o); setIsChangeSupplierModalOpen(true); }}
                                                onItemDrop={handleDropOnSupplier}
                                                onDragItemStart={handleItemDragStart}
                                                onQuantityClick={handleQuantityClick}
                                                onSendTelegram={handleSendToTelegram}
                                                onAddModalOpen={(o) => { setOrderForAddItem(o); setIsAddItemModalOpen(true); }}
                                                onPaymentClick={(o) => { setPaymentModalOrder(o); }}
                                                singleColumn={singleColumn}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
        {numpadItem && <NumpadModal isOpen={!!numpadItem} item={numpadItem.item} onClose={() => setNumpadItem(null)} onSave={handleSaveItemQuantity} onDelete={handleDeleteItem} onSwitchToPrice={handleSwitchToPriceFromNumpad} />}
        {priceNumpadItem && <PriceNumpadModal isOpen={!!priceNumpadItem} item={priceNumpadItem.item} supplierId={priceNumpadItem.order.supplierId} onClose={() => setPriceNumpadItem(null)} onSave={handleSavePriceFromModal} />}
        {paymentModalOrder && <PaymentMethodModal isOpen={!!paymentModalOrder} onClose={() => setPaymentModalOrder(null)} onSelect={handlePaymentMethodSelect} order={paymentModalOrder} />}
        {orderForAddItem && isAddItemModalOpen && <AddItemModal isOpen={isAddItemModalOpen} onClose={() => setIsAddItemModalOpen(false)} onItemSelect={handleAddItemFromModal} order={orderForAddItem} />}
        <AddSupplierModal isOpen={isAddSupplierModalOpen} onClose={() => setIsAddSupplierModalOpen(false)} onSelect={handleAddSupplier} title="Add Card" />
        <AddSupplierModal isOpen={isChangeSupplierModalOpen} onClose={() => setIsChangeSupplierModalOpen(false)} onSelect={handleChangeSupplier} title="Change Supplier" />
        <PasteItemsModal isOpen={isPasteItemsModalOpen} onClose={() => setIsPasteItemsModalOpen(false)} />
        </>
    );
};

export default ManagerReportView;
