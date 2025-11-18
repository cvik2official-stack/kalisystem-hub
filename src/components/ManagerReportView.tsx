

import React, { useContext, useMemo, useState, useRef, useEffect } from 'react';
import { Order, StoreName, OrderItem, Unit, PaymentMethod, OrderStatus, SupplierName, Supplier, Item } from '../types';
import { AppContext } from '../context/AppContext';
import { getLatestItemPrice, generateOrderMessage } from '../utils/messageFormatter';
import { sendOrderToSupplierOnTelegram } from '../services/telegramService';
import { useNotifier } from '../context/NotificationContext';
import NumpadModal from './modals/NumpadModal';
import PaymentMethodModal from './modals/PaymentMethodModal';

// Timezone helpers duplicated from OrderWorkspace to ensure consistency without circular deps or complex refactoring
const PHNOM_PENH_OFFSET = 7 * 60;
const getPhnomPenhDate = (date?: Date | string): Date => {
    const d = date ? new Date(date) : new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (PHNOM_PENH_OFFSET * 60000));
};
const getPhnomPenhDateKey = (date?: Date | string): string => {
    return getPhnomPenhDate(date).toISOString().split('T')[0];
};

const formatDateGroupHeader = (key: string): string => {
    if (key === 'Today') return 'Today';
    
    const todayPhnomPenh = getPhnomPenhDate();
    const todayKey = todayPhnomPenh.toISOString().split('T')[0];
  
    const yesterdayPhnomPenh = getPhnomPenhDate();
    yesterdayPhnomPenh.setDate(yesterdayPhnomPenh.getDate() - 1);
    const yesterdayKey = yesterdayPhnomPenh.toISOString().split('T')[0];
    
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
}

const AutocompleteInput: React.FC<{
    placeholder: string;
    suggestions: { id: string, name: string, lastQty?: string }[];
    onSelect: (selected: { id: string, name: string, lastQty?: string }) => void;
    onCreate?: (newName: string) => void;
    onBlur?: () => void;
}> = ({ placeholder, suggestions, onSelect, onCreate, onBlur }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isFocused, setIsFocused] = useState(true);
    const [activeIndex, setActiveIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);
    
    const handleBlur = () => {
        setTimeout(() => {
            if (onBlur) onBlur();
            setIsFocused(false);
        }, 150);
    };

    const filteredSuggestions = useMemo(() => {
        if (!searchTerm) return suggestions;
        return suggestions.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, suggestions]);

    const handleSelect = (item: { id: string, name: string, lastQty?: string }) => {
        onSelect(item);
        setSearchTerm('');
        setIsFocused(false);
    };

    const handleCreate = () => {
        if (onCreate && searchTerm.trim() && !filteredSuggestions.some(s => s.name.toLowerCase() === searchTerm.trim().toLowerCase())) {
            onCreate(searchTerm.trim());
            setSearchTerm('');
            setIsFocused(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex > -1 && filteredSuggestions[activeIndex]) {
                handleSelect(filteredSuggestions[activeIndex]);
            } else {
                handleCreate();
            }
        } else if (e.key === 'Escape') {
            setIsFocused(false);
            if (onBlur) onBlur();
            (e.target as HTMLInputElement).blur();
        }
    };
    
    return (
        <div className="relative">
            <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setActiveIndex(-1); }}
                onFocus={() => setIsFocused(true)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="bg-transparent p-1 w-full rounded outline-none text-sm placeholder-gray-500 text-gray-300 focus:bg-gray-800"
            />
            {isFocused && (
                <ul className="absolute bottom-full left-0 right-0 mb-1 bg-gray-700 rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
                    {filteredSuggestions.map((item, index) => (
                        <li key={item.id}>
                            <button onMouseDown={() => handleSelect(item)} className={`w-full text-left p-2 text-sm flex justify-between items-center ${activeIndex === index ? 'bg-indigo-600' : 'hover:bg-indigo-500/50'}`}>
                                <span className="text-white truncate pr-2">{item.name}</span>
                                {item.lastQty && <span className="text-gray-400 ml-2 flex-shrink-0">{item.lastQty}</span>}
                            </button>
                        </li>
                    ))}
                    {onCreate && searchTerm.trim() && !filteredSuggestions.some(s => s.name.toLowerCase() === searchTerm.trim().toLowerCase()) && (
                         <li><button onMouseDown={handleCreate} className={`w-full text-left p-2 text-sm ${activeIndex === -1 ? 'bg-indigo-600' : 'hover:bg-indigo-500/50'}`}><span className="text-indigo-300">+ Create "{searchTerm.trim()}"</span></button></li>
                    )}
                </ul>
            )}
        </div>
    );
};

const getLastQuantity = (itemId: string, orders: Order[]): number => {
    const relevantOrders = orders
        .filter(o => o.status === OrderStatus.COMPLETED && o.completedAt && o.items.some(i => i.itemId === itemId))
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
    
    if (relevantOrders.length > 0) {
        const item = relevantOrders[0].items.find(i => i.itemId === itemId);
        return item ? item.quantity : 1;
    }
    return 1;
};

const AutocompleteAddItem: React.FC<{ order: Order }> = ({ order }) => {
    const { state, actions } = useContext(AppContext);
    const { notify } = useNotifier();
    const [isEditing, setIsEditing] = useState(false);

    const handleAddItem = async (item: Item) => {
        const lastQty = getLastQuantity(item.id, state.orders);
        const orderItem: OrderItem = {
            itemId: item.id,
            name: item.name,
            quantity: lastQty,
            unit: item.unit,
        };
        const newItems = [...order.items, orderItem];
        await actions.updateOrder({ ...order, items: newItems });
        notify(`Added ${item.name} x${lastQty}`, 'success');
    };

    const handleCreateAndAddItem = async (newName: string) => {
        try {
            const newItem = await actions.addItem({
                name: newName,
                unit: Unit.PC,
                supplierId: order.supplierId,
                supplierName: order.supplierName,
            });
            handleAddItem(newItem);
        } catch (e: any) {
            notify(`Error creating item: ${e.message}`, 'error');
        }
    };
    
    if (!isEditing) {
        return (
            <button 
                onClick={() => setIsEditing(true)} 
                className="text-left text-gray-500 hover:text-white hover:bg-gray-700/50 text-sm p-1 pl-2 rounded-md w-full transition-colors flex items-center"
            >
                <span className="mr-1">+</span> Add item
            </button>
        );
    }
    
    const itemsInOrder = new Set(order.items.map(i => i.itemId));
    
    const suggestions = state.items
        .filter(item => !itemsInOrder.has(item.id))
        .map(item => {
            const lastQty = getLastQuantity(item.id, state.orders);
            return {
                id: item.id,
                name: item.name,
                lastQty: `${lastQty}${item.unit}`,
            };
        });

    return (
        <AutocompleteInput
            placeholder="Search item..."
            suggestions={suggestions}
            onSelect={(selected) => {
                const item = state.items.find(i => i.id === selected.id);
                if (item) handleAddItem(item);
                setIsEditing(false);
            }}
            onCreate={(newName) => {
                handleCreateAndAddItem(newName);
                setIsEditing(false);
            }}
            onBlur={() => setIsEditing(false)}
        />
    );
};

const DispatchQuickAdd: React.FC<{}> = () => {
    const { state, actions } = useContext(AppContext);
    const [selectedStore, setSelectedStore] = useState<StoreName | null>(null);
    const [mode, setMode] = useState<'store' | 'action'>('store');
    const [action, setAction] = useState<'supplier' | 'paste' | null>(null);

    const storeSuggestions = state.stores.map(s => ({ id: s.id, name: s.name }));
    const supplierSuggestions = state.suppliers.map(s => ({ id: s.id, name: s.name }));

    const handleSelectStore = (store: { name: string }) => {
        setSelectedStore(store.name as StoreName);
        setMode('action');
    };

    const handleSelectSupplier = async (supplierInfo: { id: string, name: string }) => {
        if (!selectedStore) return;
        const supplier = state.suppliers.find(s => s.id === supplierInfo.id);
        if (supplier) {
            await actions.addOrder(supplier, selectedStore);
        }
        setAction(null); 
    };

    const handleCreateSupplier = async (name: string) => {
        if (selectedStore) {
            const newSupplier = await actions.addSupplier({ name: name as SupplierName });
            await actions.addOrder(newSupplier, selectedStore);
        }
        setAction(null);
    };

    const handlePaste = async (e: React.FocusEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        if (text.trim() && selectedStore) {
            await actions.pasteItemsForStore(text, selectedStore);
        }
        e.target.value = '';
        setAction(null); 
    };
    
    const reset = () => {
        setSelectedStore(null);
        setMode('store');
        setAction(null);
    }

    if (mode === 'store') {
        return <div className="p-2 bg-gray-900/50 rounded-md"><AutocompleteInput placeholder="+ select store" suggestions={storeSuggestions} onSelect={handleSelectStore} onBlur={() => { if(!selectedStore) reset()}} /></div>;
    }

    return (
        <div className="space-y-2 p-2 bg-gray-900/50 rounded-md">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer" onClick={reset}>{selectedStore}</h4>
            {action === 'supplier' ? (
                <AutocompleteInput placeholder="+ select supplier" suggestions={supplierSuggestions} onSelect={handleSelectSupplier} onCreate={handleCreateSupplier} onBlur={() => setAction(null)} />
            ) : action === 'paste' ? (
                <textarea
                    autoFocus
                    onBlur={handlePaste}
                    placeholder="Paste items here and click away..."
                    className="w-full h-24 bg-gray-700 text-gray-200 rounded-md p-2 font-mono text-xs outline-none"
                />
            ) : (
                <div className="space-y-1">
                    <button onClick={() => setAction('supplier')} className="text-left text-indigo-400 hover:text-indigo-300 text-sm p-1 rounded w-full">+ select supplier</button>
                    <div className="text-center"><span className="text-gray-600 text-xs">or</span></div>
                    <button onClick={() => setAction('paste')} className="text-left text-indigo-400 hover:text-indigo-300 text-sm p-1 rounded w-full">paste a list</button>
                </div>
            )}
        </div>
    );
};


const ManagerReportView: React.FC<ManagerReportViewProps> = (props) => {
    const { state, dispatch, actions } = useContext(AppContext);
    const { suppliers, itemPrices, draggedItem, draggedOrderId } = state;
    const { notify } = useNotifier();
    const { orders, singleColumn, onItemDrop, hideTitle } = props;
    
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
    const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
    const [numpadItem, setNumpadItem] = useState<{ order: Order, item: OrderItem } | null>(null);

    const isSmartView = !!singleColumn;

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
        
        columnOrders.forEach(order => {
            const completedDateKey = getPhnomPenhDateKey(order.completedAt);
            const key = completedDateKey === todayKey ? 'Today' : completedDateKey;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(order);
        });

        // Also ensure "Today" and "Yesterday" groups exist, even if empty.
        const yesterdayKey = getPhnomPenhDateKey(new Date(Date.now() - 86400000));
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

    const sortOrders = (ordersToSort: Order[]) => {
        return [...ordersToSort].sort((a,b) => {
            const storeCompare = a.store.localeCompare(b.store);
            if(storeCompare !== 0) return storeCompare;
            const nameA = a.supplierName; const nameB = b.supplierName;
            if (nameA === lastSupplier && nameB !== lastSupplier) return 1; if (nameB === lastSupplier && nameA !== lastSupplier) return -1;
            const indexA = customSortOrder.indexOf(nameA); const indexB = customSortOrder.indexOf(nameB);
            if (indexA > -1 && indexB > -1) return indexA - indexB; if (indexA > -1) return -1; if (indexB > -1) return 1;
            return nameA.localeCompare(b.supplierName);
        });
    };

    const sortedFlatOrders = isSmartView ? sortOrders(columnOrders) : [];


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
                            {isStockMovement && <div className="w-12 text-right font-semibold text-yellow-400">{order.supplierName === SupplierName.STOCK ? 'out' : 'in'}</div>}
                            <div className="w-16 text-right">{itemQuantityContent}</div>
                            <div className="w-20 text-right">{itemPriceContent}</div>
                        </div>
                    </li>
                );
            })}
             {(singleColumn === 'dispatch' || singleColumn === 'on_the_way') && (
                 <li className="mt-2">
                    <AutocompleteAddItem order={order} />
                 </li>
             )}
        </ul>
    );

    const toggleStore = (storeName: string) => setExpandedStores(prev => { const newSet = new Set(prev); if (newSet.has(storeName)) newSet.delete(storeName); else newSet.add(storeName); return newSet; });
    const toggleSupplier = (orderId: string) => setExpandedSuppliers(prev => { const newSet = new Set(prev); if (newSet.has(orderId)) newSet.delete(orderId); else newSet.add(orderId); return newSet; });
    
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
        const { showStoreName = true } = options;
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
                        {showStoreName && <span className="font-semibold text-gray-500 whitespace-nowrap">{order.store}</span>}
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
                </h2>
            )}
            
            <div className="space-y-1 flex-grow pr-2 -mr-2 overflow-y-auto hide-scrollbar">
                {isSmartView ? (
                    // Smart View Logic
                    singleColumn === 'completed' ? (
                        <>
                            {sortedCompletedGroupKeys.map(key => {
                                const ordersInDateGroup = groupedCompletedOrders[key] || [];

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
                                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2 mt-1 pl-1">{formatDateGroupHeader(key)}</div>
                                        <div className="space-y-3 mb-6">
                                            {ordersInDateGroup.length > 0 ? (
                                                sortedStoresInGroup.map(storeName => {
                                                    const storeOrders = ordersByStore[storeName].sort((a, b) => {
                                                        const nameA = a.supplierName; const nameB = b.supplierName;
                                                        if (nameA === lastSupplier && nameB !== lastSupplier) return 1; if (nameB === lastSupplier && nameA !== lastSupplier) return -1;
                                                        const indexA = customSortOrder.indexOf(nameA); const indexB = customSortOrder.indexOf(nameB);
                                                        if (indexA > -1 && indexB > -1) return indexA - indexB; if (indexA > -1) return -1; if (indexB > -1) return 1;
                                                        return nameA.localeCompare(b.supplierName);
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
                                    </div>
                                )
                            })}
                        </>
                    ) : (
                        // Dispatch & On The Way (Flat lists)
                        <div className="space-y-1">
                            {singleColumn === 'dispatch' && <DispatchQuickAdd />}
                            {sortedFlatOrders.map(order => renderOrderCard(order))}
                        </div>
                    )
                ) : (
                    // Grouped by store for other views (Manager View specifically)
                    sortedStoreNames.map(storeName => {
                    const isStoreExpanded = expandedStores.has(storeName);
                    const storeOrders = (groupedByStore[storeName] || []).sort((a, b) => {
                        const nameA = a.supplierName; const nameB = b.supplierName;
                        if (nameA === lastSupplier && nameB !== lastSupplier) return 1; if (nameB === lastSupplier && nameA !== lastSupplier) return -1;
                        const indexA = customSortOrder.indexOf(nameA); const indexB = customSortOrder.indexOf(nameB);
                        if (indexA > -1 && indexB > -1) return indexA - indexB; if (indexA > -1) return -1; if (indexB > -1) return 1;
                        return nameA.localeCompare(b.supplierName);
                    });
                    if (storeOrders.length === 0) return null;

                    return (
                        <div key={storeName}>
                            <button onClick={() => toggleStore(storeName)} className="flex items-center w-full text-left py-1">
                                <h3 className="font-bold text-white text-xs uppercase ml-1">{storeName}</h3>
                            </button>
                            {isStoreExpanded && (
                                <div className="space-y-1 pl-2">
                                    {storeOrders.map(order => {
                                        // Reuse render logic logic but slightly different context (store group)
                                        // The main difference is the store name display, but in Manager View we show it anyway
                                        // So we can actually just call renderOrderCard here too.
                                        return renderOrderCard(order);
                                    })}
                                </div>
                            )}
                        </div>
                    );
                }))}
            </div>
        </div>
        {numpadItem && <NumpadModal isOpen={!!numpadItem} item={numpadItem.item} onClose={() => setNumpadItem(null)} onSave={handleSaveItemQuantity} onDelete={handleDeleteItem} />}
        <PaymentMethodModal isOpen={!!paymentModalOrder} onClose={() => setPaymentModalOrder(null)} onSelect={handlePaymentMethodSelect} order={paymentModalOrder!} />
        </>
    );
};

export default ManagerReportView;