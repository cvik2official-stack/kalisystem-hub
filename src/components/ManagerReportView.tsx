
import React, { useContext, useMemo, useState, useRef, useEffect } from 'react';
import { Order, StoreName, OrderItem, Unit, PaymentMethod, OrderStatus, SupplierName, Supplier, Item } from '../types';
import { AppContext } from '../context/AppContext';
import { getLatestItemPrice, generateOrderMessage, getPhnomPenhDateKey } from '../utils/messageFormatter';
import { sendOrderToSupplierOnTelegram } from '../services/telegramService';
import { useNotifier } from '../context/NotificationContext';
import NumpadModal from './modals/NumpadModal';
import PaymentMethodModal from './modals/PaymentMethodModal';
import AddItemModal from './modals/AddItemModal';
import AddSupplierModal from './modals/AddSupplierModal';
import PasteItemsModal from './modals/PasteItemsModal';


const formatDateGroupHeader = (key: string): string => {
    if (key === 'Today') return 'Today';
    
    const todayKey = getPhnomPenhDateKey();
  
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = getPhnomPenhDateKey(yesterdayDate);
    
    if (key === todayKey) return 'Today'; 
    if (key === yesterdayKey) return 'Yesterday';
  
    const [year, month, day] = key.split('-').map(Number);
    return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${String(year).slice(-2)}`;
};

interface ManagerReportViewProps {
    orders: Order[];
    singleColumn?: 'dispatch' | 'on_the_way' | 'completed';
    onItemDrop: (destinationOrderId: string) => void;
    hideTitle?: boolean;
    showStoreName?: boolean;
}


const ManagerReportView: React.FC<ManagerReportViewProps> = (props) => {
    const { state, dispatch, actions } = useContext(AppContext);
    const { suppliers, itemPrices, draggedItem, draggedOrderId } = state;
    const { notify } = useNotifier();
    const { orders, singleColumn, onItemDrop, hideTitle, showStoreName } = props;
    
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
    const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
    const [numpadItem, setNumpadItem] = useState<{ order: Order, item: OrderItem } | null>(null);
    
    // Modal States
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
    const [orderForAddItem, setOrderForAddItem] = useState<Order | null>(null);
    const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
    const [isPasteItemsModalOpen, setIsPasteItemsModalOpen] = useState(false);


    const columnOrders = useMemo(() => {
        if (!singleColumn) return orders;
        const statusMap = { 'dispatch': OrderStatus.DISPATCHING, 'on_the_way': OrderStatus.ON_THE_WAY, 'completed': OrderStatus.COMPLETED };
        const status = statusMap[singleColumn];
        return orders.filter(o => o.status === status);
    }, [orders, singleColumn]);
    
    const groupedCompletedOrders = useMemo(() => {
        if (singleColumn !== 'completed') return {};
        
        const groups: Record<string, Order[]> = {};
        const todayKey = getPhnomPenhDateKey();
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayKey = getPhnomPenhDateKey(yesterdayDate);
        
        columnOrders.forEach(order => {
            const completedDateKey = getPhnomPenhDateKey(order.completedAt);
            const key = completedDateKey === todayKey ? 'Today' : completedDateKey;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(order);
        });

        // Also ensure "Today" and "Yesterday" groups exist, even if empty.
        if (!groups['Today']) {
            groups['Today'] = [];
        }
        if (!groups[yesterdayKey]) {
            groups[yesterdayKey] = [];
        }
        
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


    const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set(columnOrders.map(o => o.store)));
    const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(() => {
        // Always expand all suppliers initially
        return new Set(columnOrders.map(o => o.id));
    });

    // Added state for expanded date groups in completed column
    const [expandedDateGroups, setExpandedDateGroups] = useState<Set<string>>(new Set(['Today']));

    const groupedByStore = useMemo(() => {
        const storeGroups: Record<string, Order[]> = {};
        columnOrders.forEach(order => {
            if (!storeGroups[order.store]) storeGroups[order.store] = [];
            storeGroups[order.store].push(order);
        });
        return storeGroups;
    }, [columnOrders]);
    
    const customSortOrder: string[] = ['KALI', 'STOCK'];
    const lastSupplier = 'PISEY';
    
    const sortedStoreNames = useMemo(() => Object.keys(groupedByStore).sort((a, b) => a.localeCompare(b)), [groupedByStore]);

    const handleItemDragStart = (e: React.DragEvent, item: OrderItem, sourceOrderId: string) => {
        if (editingNameId || editingPriceId) { e.preventDefault(); return; }
        e.stopPropagation();
        dispatch({ type: 'SET_DRAGGED_ITEM', payload: { item, sourceOrderId } });
    };
    
    const handleCardDragStart = (e: React.DragEvent, orderId: string) => {
        if (editingNameId || editingPriceId) { e.preventDefault(); return; }
        e.stopPropagation();
        dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: orderId });
    };

    const handleDropOnSupplier = (e: React.DragEvent, destinationOrderId: string) => {
        e.preventDefault(); e.stopPropagation();
        if (draggedItem) onItemDrop(destinationOrderId);
    };

    const handleItemNameSave = async (order: Order, itemToUpdate: OrderItem, newName: string) => {
        setEditingNameId(null);
        const trimmedName = newName.trim();
        if (itemToUpdate.name === trimmedName || trimmedName === '') return;
        const updatedItems = order.items.map(i => (i.itemId === itemToUpdate.itemId && i.isSpoiled === itemToUpdate.isSpoiled) ? { ...i, name: trimmedName } : i);
        await actions.updateOrder({ ...order, items: updatedItems });
    };

    const handleSaveInlinePrice = async (order: Order, itemToUpdate: OrderItem, totalPriceStr: string) => {
      setEditingPriceId(null);
      let newTotalPrice: number | null;
      const trimmedPriceStr = totalPriceStr.trim();
  
      if (trimmedPriceStr === '') {
        newTotalPrice = null;
      } else if (trimmedPriceStr.startsWith('=')) {
        try {
          const expression = trimmedPriceStr.substring(1);
          newTotalPrice = new Function('return ' + expression)();
          if (typeof newTotalPrice !== 'number' || !isFinite(newTotalPrice)) {
            notify('Invalid calculation result.', 'error');
            return;
          }
        } catch (e) {
          notify('Invalid formula.', 'error');
          return;
        }
      } else {
        newTotalPrice = parseFloat(trimmedPriceStr);
      }
      
      if (newTotalPrice !== null && newTotalPrice > 1000) newTotalPrice /= 4000;
      
      if (newTotalPrice === null) {
        const { price, ...itemWithoutPrice } = itemToUpdate;
        if (itemToUpdate.price !== undefined) await actions.updateOrder({ ...order, items: order.items.map(i => i.itemId === itemToUpdate.itemId ? itemWithoutPrice : i) });
        return;
      }
      if (itemToUpdate.quantity === 0) { notify('Cannot set price for item with quantity 0.', 'error'); return; }
      if (newTotalPrice !== null && !isNaN(newTotalPrice) && newTotalPrice >= 0) {
        const newUnitPrice = newTotalPrice / itemToUpdate.quantity;
        const updatedItems = order.items.map(i => (i.itemId === itemToUpdate.itemId && i.isSpoiled === itemToUpdate.isSpoiled) ? { ...i, price: newUnitPrice } : i);
        await actions.updateOrder({ ...order, items: updatedItems });
      } else {
        notify('Invalid price.', 'error');
      }
    };
    
    const handleSendToTelegram = async (order: Order) => {
        const { settings, suppliers, stores } = state;
        const currentSupplier = suppliers.find(s => s.id === order.supplierId);
        if (!currentSupplier || !currentSupplier.chatId || !settings.telegramBotToken) { notify('Supplier Chat ID or Bot Token is not configured.', 'error'); return; }
        try {
            await sendOrderToSupplierOnTelegram(order, currentSupplier, generateOrderMessage(order, 'html', suppliers, stores, settings), settings.telegramBotToken);
            notify(`Order sent to ${order.supplierName}.`, 'success');
            // Auto move to on the way if dispatching
            if (order.status === OrderStatus.DISPATCHING) {
                await actions.updateOrder({ ...order, isSent: true, status: OrderStatus.ON_THE_WAY });
            }
        } catch (error: any) {
            notify(error.message || `Failed to send.`, 'error');
        }
    };

    const handleQuantityClick = (order: Order, item: OrderItem) => {
        setNumpadItem({ order, item });
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
    
    const handlePaymentMethodSelect = async (method: PaymentMethod) => {
        if (paymentModalOrder) {
            await actions.updateOrder({ ...paymentModalOrder, paymentMethod: method });
            setPaymentModalOrder(null);
        }
    };

    const handleOpenAddItemModal = (order: Order) => {
        setOrderForAddItem(order);
        setIsAddItemModalOpen(true);
    };

    const handleAddItemFromModal = async (item: Item) => {
        if (!orderForAddItem) return;
        
        const existingItemIndex = orderForAddItem.items.findIndex(i => i.itemId === item.id && !i.isSpoiled);
        
        let newItems;
        if (existingItemIndex > -1) {
            newItems = [...orderForAddItem.items];
            newItems[existingItemIndex] = {
                ...newItems[existingItemIndex],
                quantity: newItems[existingItemIndex].quantity + 1
            };
        } else {
            const newItem: OrderItem = {
                itemId: item.id,
                name: item.name,
                quantity: 1,
                unit: item.unit,
                isNew: orderForAddItem.status === OrderStatus.ON_THE_WAY,
            };
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

    const renderItemsForSupplier = (order: Order) => (
        <ul className="text-sm">
            {order.items.map(item => {
                const uniqueItemId = `${item.itemId}-${item.isSpoiled ? 'spoiled' : 'clean'}`;
                const latestPriceInfo = getLatestItemPrice(item.itemId, order.supplierId, itemPrices);
                const unitPrice = item.price ?? latestPriceInfo?.price ?? 0;
                const totalPrice = unitPrice * item.quantity;
                const isKaliOrder = order.supplierName === SupplierName.KALI || order.paymentMethod === PaymentMethod.KALI;
                const isStockMovement = order.supplierName === SupplierName.STOCK || order.paymentMethod === PaymentMethod.STOCK;
                const isEditingName = editingNameId === uniqueItemId;
                const isEditingPrice = editingPriceId === uniqueItemId;

                const itemNameContent = isEditingName ? (
                    <input 
                        type="text" 
                        defaultValue={item.name} 
                        autoFocus 
                        onBlur={(e) => handleItemNameSave(order, item, e.target.value)} 
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} 
                        className="bg-gray-700 text-white p-0 w-full rounded outline-none"
                    />
                ) : (
                    <span onClick={() => setEditingNameId(uniqueItemId)} className="truncate cursor-pointer hover:text-white">{item.name}</span>
                );

                const itemQuantityContent = (
                     <span className="text-right w-16 cursor-pointer hover:bg-gray-700 p-1 -m-1 rounded-md" onClick={() => handleQuantityClick(order, item)}>
                        {item.quantity}{item.unit}
                    </span>
                );

                const itemPriceContent = isEditingPrice ? (
                     <input 
                        type="text" 
                        inputMode="decimal" 
                        defaultValue={totalPrice > 0 ? totalPrice.toFixed(2) : ''} 
                        autoFocus 
                        onBlur={(e) => handleSaveInlinePrice(order, item, e.target.value)} 
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} 
                        className={`bg-gray-700 p-0 w-20 text-right rounded outline-none font-mono ${isKaliOrder ? 'text-purple-300' : 'text-cyan-300'}`}
                    />
                ) : (
                    <span onClick={() => setEditingPriceId(uniqueItemId)} className={`font-mono text-right w-20 cursor-pointer hover:bg-gray-700 p-1 -m-1 rounded-md ${isKaliOrder ? 'text-purple-300' : 'text-cyan-300'}`}>
                        {totalPrice > 0 ? totalPrice.toFixed(2) : '-'}
                    </span>
                );

                return (
                    <li key={uniqueItemId} className="flex items-center group py-0.5" draggable={!isEditingName && !isEditingPrice} onDragStart={(e) => handleItemDragStart(e, item, order.id)} onDragEnd={() => dispatch({ type: 'SET_DRAGGED_ITEM', payload: null })}>
                        <div className="flex-grow truncate pr-2">{itemNameContent}</div>
                        <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                            {isStockMovement ? (
                                order.supplierName === SupplierName.STOCK ? (
                                    <span className="font-semibold text-yellow-400">out</span>
                                ) : ( // This implicitly means paymentMethod is STOCK if the outer condition is true
                                    <span className="font-semibold text-green-400">in</span>
                                )
                            ) : null}
                            <div className="w-16 text-right">{itemQuantityContent}</div>
                            <div className="w-20 text-right">{itemPriceContent}</div>
                        </div>
                    </li>
                );
            })}
             {(singleColumn === 'dispatch' || singleColumn === 'on_the_way') && (
                 <li className="mt-2">
                    <button 
                        onClick={() => handleOpenAddItemModal(order)} 
                        className="text-left text-gray-500 hover:text-white hover:bg-gray-700/50 text-sm p-1 pl-2 rounded-md w-full transition-colors flex items-center"
                    >
                        <span className="mr-1">+</span> Add item
                    </button>
                 </li>
             )}
        </ul>
    );

    const toggleStore = (storeName: string) => setExpandedStores(prev => { const newSet = new Set(prev); if (newSet.has(storeName)) newSet.delete(storeName); else newSet.add(storeName); return newSet; });
    const toggleSupplier = (orderId: string) => setExpandedSuppliers(prev => { const newSet = new Set(prev); if (newSet.has(orderId)) newSet.delete(orderId); else newSet.add(orderId); return newSet; });
    const toggleDateGroup = (dateKey: string) => setExpandedDateGroups(prev => { const newSet = new Set(prev); if (newSet.has(dateKey)) newSet.delete(dateKey); else newSet.add(dateKey); return newSet; });
    
    const title = singleColumn ? singleColumn.replace(/_/g, ' ') : '';
    
    // Updated colors to match the badge text colors
    const paymentBadgeColors: Record<string, string> = {
        [PaymentMethod.ABA]: 'text-blue-300',
        [PaymentMethod.CASH]: 'text-green-300',
        [PaymentMethod.KALI]: 'text-purple-300',
        [PaymentMethod.STOCK]: 'text-gray-300',
        [PaymentMethod.MISHA]: 'text-orange-300',
    };

    const renderOrderCard = (order: Order, options: { showStoreName?: boolean } = {}) => {
        const { showStoreName: showStoreNameProp = showStoreName } = options;
        const supplier = suppliers.find(s => s.id === order.supplierId);
        const paymentMethod = order.paymentMethod || supplier?.paymentMethod;
        const cardTotal = order.items.reduce((total, item) => {
             if (item.isSpoiled) return total;
             const unitPrice = item.price ?? getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price ?? 0;
             return total + (unitPrice * item.quantity);
        }, 0);
        const isDraggingThis = draggedOrderId === order.id;
        const isSupplierExpanded = expandedSuppliers.has(order.id);
        const isKaliOrder = order.supplierName === SupplierName.KALI || paymentMethod === PaymentMethod.KALI;
        const canSendTelegram = (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY) && supplier?.chatId;
        const paymentColorClass = paymentMethod ? (paymentBadgeColors[paymentMethod] || 'text-gray-400') : 'text-gray-600';

        return (
             <div key={order.id} draggable={!editingNameId && !editingPriceId} onDragStart={(e) => handleCardDragStart(e, order.id)} onDragEnd={() => dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: null })} onDragOver={(e) => { if(draggedItem) e.preventDefault(); }} onDrop={(e) => handleDropOnSupplier(e, order.id)} className={`py-1 ${(!editingNameId && !editingPriceId) ? 'cursor-grab active:cursor-grabbing' : ''} ${isDraggingThis ? 'opacity-50' : ''}`}>
                <div onClick={() => toggleSupplier(order.id)} className="flex items-center justify-between text-xs font-bold uppercase space-x-2 cursor-pointer">
                    <div className="flex items-center space-x-2 overflow-hidden">
                        {showStoreNameProp && <span className="font-semibold text-gray-500 whitespace-nowrap">{order.store}</span>}
                        <span className={`whitespace-nowrap ${isKaliOrder ? 'text-purple-300' : 'text-gray-300'}`}>{order.supplierName}</span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setPaymentModalOrder(order); }}
                            className={`font-semibold whitespace-nowrap hover:underline ${paymentColorClass}`}
                        >
                            {paymentMethod || 'PAYMENT'}
                        </button>
                        {singleColumn !== 'dispatch' && cardTotal > 0 && <span className={`whitespace-nowrap ${paymentColorClass}`}>{cardTotal.toFixed(2)}</span>}
                    </div>
                    {canSendTelegram && (
                        <button onClick={(e) => {e.stopPropagation(); handleSendToTelegram(order);}} className="text-blue-400 hover:text-white p-1 flex-shrink-0" title="Send to Telegram">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.51.71l-4.84-3.56-2.22 2.15c-.22.21-.4.33-.7.33z"></path></svg>
                        </button>
                    )}
                </div>
                {isSupplierExpanded && renderItemsForSupplier(order)}
            </div>
        );
    };

    return (
        <>
        <div className="outline-none h-full flex flex-col">
            {!hideTitle && (
                <h2 className="capitalize text-lg font-semibold px-1 py-2 flex items-center space-x-2 text-white">
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

                                const ordersByStore = ordersInDateGroup.reduce((acc, order) => {
                                    if (!acc[order.store]) {
                                        acc[order.store] = [];
                                    }
                                    acc[order.store].push(order);
                                    return acc;
                                }, {} as Record<string, Order[]>);
                    
                                const sortedStoresInGroup = Object.keys(ordersByStore).sort();

                                if (ordersInDateGroup.length === 0 && formatDateGroupHeader(key) !== 'Today' && formatDateGroupHeader(key) !== 'Yesterday') {
                                    return null;
                                }

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
                                                {ordersInDateGroup.length > 0 ? (
                                                    sortedStoresInGroup.map(storeName => {
                                                        const storeOrders = ordersByStore[storeName].sort((a, b) => {
                                                            const nameA = a.supplierName; const nameB = b.supplierName;
                                                            if (nameA === lastSupplier && nameB !== lastSupplier) return 1; if (nameB === lastSupplier && nameA !== lastSupplier) return -1;
                                                            const indexA = customSortOrder.indexOf(nameA); const indexB = customSortOrder.indexOf(nameB);
                                                            if (indexA > -1 && indexB > -1) return indexA - indexB; if (indexA > -1) return -1; if (indexB > -1) return 1;
                                                            return nameA.localeCompare(nameB);
                                                        });
                        
                                                        return (
                                                            <div key={storeName}>
                                                                <h4 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1 pl-1">{storeName}</h4>
                                                                <div className="space-y-1 pl-2 border-l-2 border-gray-700/50">
                                                                    {storeOrders.map(order => renderOrderCard(order, { showStoreName: false }))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="text-gray-600 text-xs pl-2 italic">No completed orders.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </>
                    ) : (
                    sortedStoreNames.map(storeName => {
                        const isStoreExpanded = expandedStores.has(storeName);
                        const storeOrders = (groupedByStore[storeName] || []).sort((a, b) => {
                            const nameA = a.supplierName; const nameB = b.supplierName;
                            if (nameA === lastSupplier && nameB !== lastSupplier) return 1; if (nameB === lastSupplier && nameA !== lastSupplier) return -1;
                            const indexA = customSortOrder.indexOf(nameA); const indexB = customSortOrder.indexOf(nameB);
                            if (indexA > -1 && indexB > -1) return indexA - indexB; if (indexA > -1) return -1; if (indexB > -1) return 1;
                            return nameA.localeCompare(nameB);
                        });
                        
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
                                        {storeOrders.map(order => {
                                            return renderOrderCard(order, { showStoreName: false });
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
        {numpadItem && <NumpadModal isOpen={!!numpadItem} item={numpadItem.item} onClose={() => setNumpadItem(null)} onSave={handleSaveItemQuantity} onDelete={handleDeleteItem} />}
        {paymentModalOrder && <PaymentMethodModal isOpen={!!paymentModalOrder} onClose={() => setPaymentModalOrder(null)} onSelect={handlePaymentMethodSelect} order={paymentModalOrder} />}
        {orderForAddItem && isAddItemModalOpen && <AddItemModal isOpen={isAddItemModalOpen} onClose={() => setIsAddItemModalOpen(false)} onItemSelect={handleAddItemFromModal} order={orderForAddItem} />}
        <AddSupplierModal isOpen={isAddSupplierModalOpen} onClose={() => setIsAddSupplierModalOpen(false)} onSelect={handleAddSupplier} title="Add Card" />
        <PasteItemsModal isOpen={isPasteItemsModalOpen} onClose={() => setIsPasteItemsModalOpen(false)} />
        </>
    );
};

export default ManagerReportView;
