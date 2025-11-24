
import React, { useState, useContext } from 'react';
import { Order, OrderItem, OrderStatus, PaymentMethod, SupplierName, Unit, Supplier, ItemPrice } from '../types';
import { AppContext } from '../context/AppContext';
import { getLatestItemPrice } from '../utils/messageFormatter';
import { useNotifier } from '../context/NotificationContext';
import { normalizeInputPrice } from '../utils/currencyUtils';

interface ManagerOrderRowProps {
    order: Order;
    suppliers: Supplier[];
    itemPrices: ItemPrice[];
    showStoreName?: boolean;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onUpdateOrder: (order: Order) => Promise<void>;
    onDeleteOrder: (orderId: string) => void;
    onChangeSupplier: (order: Order) => void;
    onItemDrop: (e: React.DragEvent, destinationOrderId: string) => void;
    onDragItemStart: (e: React.DragEvent, item: OrderItem, sourceOrderId: string) => void;
    onQuantityClick: (order: Order, item: OrderItem) => void;
    onSendTelegram: (order: Order) => void;
    onAddModalOpen: (order: Order) => void;
    onPaymentClick: (order: Order) => void;
    singleColumn?: string;
}

const ManagerOrderRow: React.FC<ManagerOrderRowProps> = ({
    order,
    suppliers,
    itemPrices,
    showStoreName,
    isExpanded,
    onToggleExpand,
    onUpdateOrder,
    onDeleteOrder,
    onChangeSupplier,
    onItemDrop,
    onDragItemStart,
    onQuantityClick,
    onSendTelegram,
    onAddModalOpen,
    onPaymentClick,
    singleColumn
}) => {
    const { actions } = useContext(AppContext);
    const { notify } = useNotifier();
    
    // Local state for inline editing to avoid re-rendering the whole list
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingPriceId, setEditingPriceId] = useState<string | null>(null);

    const supplier = suppliers.find(s => s.id === order.supplierId);
    const paymentMethod = order.paymentMethod || supplier?.paymentMethod;
    
    const cardTotal = order.items.reduce((total, item) => {
        if (item.isSpoiled) return total;
        const unitPrice = item.price ?? getLatestItemPrice(item.itemId, order.supplierId, itemPrices)?.price ?? 0;
        return total + (unitPrice * item.quantity);
    }, 0);

    const isKaliOrder = order.supplierName === SupplierName.KALI || paymentMethod === PaymentMethod.KALI;
    const canSendTelegram = (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY) && supplier?.chatId;
    
    const paymentBadgeColors: Record<string, string> = {
        [PaymentMethod.ABA]: 'text-blue-300',
        [PaymentMethod.CASH]: 'text-green-300',
        [PaymentMethod.KALI]: 'text-purple-300',
        [PaymentMethod.STOCK]: 'text-gray-300',
        [PaymentMethod.MISHA]: 'text-orange-300',
    };
    const paymentColorClass = paymentMethod ? (paymentBadgeColors[paymentMethod] || 'text-gray-400') : 'text-gray-600';

    const handleItemNameSave = async (itemToUpdate: OrderItem, newName: string) => {
        setEditingNameId(null);
        const trimmedName = newName.trim();
        if (itemToUpdate.name === trimmedName || trimmedName === '') return;
        
        const updatedItems = order.items.map(i => 
            (i.itemId === itemToUpdate.itemId && i.isSpoiled === itemToUpdate.isSpoiled) 
            ? { ...i, name: trimmedName } 
            : i
        );
        await onUpdateOrder({ ...order, items: updatedItems });
        notify("Item name updated for this order.", "info");
    };

    const handleSaveInlinePrice = async (itemToUpdate: OrderItem, totalPriceStr: string) => {
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

        if (newTotalPrice !== null) {
            newTotalPrice = normalizeInputPrice(newTotalPrice);
        }

        if (newTotalPrice === null) {
            const { price, ...itemWithoutPrice } = itemToUpdate;
            if (itemToUpdate.price !== undefined) {
                await onUpdateOrder({ ...order, items: order.items.map(i => i.itemId === itemToUpdate.itemId ? itemWithoutPrice : i) });
            }
            return;
        }

        if (itemToUpdate.quantity === 0) { notify('Cannot set price for item with quantity 0.', 'error'); return; }

        if (newTotalPrice !== null && !isNaN(newTotalPrice) && newTotalPrice >= 0) {
            const newUnitPrice = newTotalPrice / itemToUpdate.quantity;

            // Check for existing master price
            const existingMaster = itemPrices.find(p => 
                p.itemId === itemToUpdate.itemId && 
                p.supplierId === order.supplierId &&
                p.unit === itemToUpdate.unit
            );

            if (!existingMaster) {
                // Create Default
                await actions.upsertItemPrice({
                    itemId: itemToUpdate.itemId,
                    supplierId: order.supplierId,
                    price: newUnitPrice,
                    unit: itemToUpdate.unit || Unit.PC
                });
                // Clear override
                const updatedItems = order.items.map(i => 
                    (i.itemId === itemToUpdate.itemId && i.isSpoiled === itemToUpdate.isSpoiled) 
                    ? { ...i, price: undefined } 
                    : i
                );
                await onUpdateOrder({ ...order, items: updatedItems });
                notify('Price set as default.', 'success');
            } else {
                // Set Override
                const updatedItems = order.items.map(i => 
                    (i.itemId === itemToUpdate.itemId && i.isSpoiled === itemToUpdate.isSpoiled) 
                    ? { ...i, price: newUnitPrice } 
                    : i
                );
                await onUpdateOrder({ ...order, items: updatedItems });
            }
        } else {
            notify('Invalid price.', 'error');
        }
    };

    return (
        <div 
            onDragOver={(e) => e.preventDefault()} 
            onDrop={(e) => onItemDrop(e, order.id)} 
            className="py-1"
        >
            <div className="flex items-center justify-between text-xs font-bold uppercase space-x-2 cursor-pointer group">
                <div onClick={onToggleExpand} className="flex items-center space-x-2 overflow-hidden flex-grow min-w-0">
                    {showStoreName && <span className="font-semibold text-gray-500 whitespace-nowrap">{order.store}</span>}
                    <span className={`whitespace-nowrap truncate ${isKaliOrder ? 'text-purple-300' : 'text-gray-300'}`}>{order.supplierName}</span>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onPaymentClick(order); }}
                        className={`font-semibold whitespace-nowrap hover:underline flex-shrink-0 ${paymentColorClass}`}
                    >
                        {paymentMethod || 'PAYMENT'}
                    </button>
                    {singleColumn !== 'dispatch' && cardTotal > 0 && <span className={`whitespace-nowrap flex-shrink-0 ${paymentColorClass}`}>{cardTotal.toFixed(2)}</span>}
                </div>
                
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="hidden group-hover:flex items-center space-x-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onChangeSupplier(order); }}
                            className="text-gray-500 hover:text-indigo-300 p-1" 
                            title="Change Supplier"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteOrder(order.id); }}
                            className="text-gray-500 hover:text-red-400 p-1" 
                            title="Delete Order"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                    
                    {canSendTelegram && (
                        <button onClick={(e) => {e.stopPropagation(); onSendTelegram(order);}} className="text-blue-400 hover:text-white p-1 flex-shrink-0" title="Send to Telegram">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.51.71l-4.84-3.56-2.22 2.15c-.22.21-.4.33-.7.33z"></path></svg>
                        </button>
                    )}
                    
                    <button className="md:hidden text-gray-500 hover:text-white p-1 flex-shrink-0" onClick={(e) => { 
                        e.stopPropagation(); 
                        onChangeSupplier(order);
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                    </button>
                </div>
            </div>
            
            {isExpanded && (
                <ul className="text-sm">
                    {order.items.map(item => {
                        const uniqueItemId = `${item.itemId}-${item.isSpoiled ? 'spoiled' : 'clean'}`;
                        const latestPriceInfo = getLatestItemPrice(item.itemId, order.supplierId, itemPrices);
                        const unitPrice = item.price ?? latestPriceInfo?.price ?? 0;
                        const totalPrice = unitPrice * item.quantity;
                        const isStockMovement = order.supplierName === SupplierName.STOCK_OUT || order.paymentMethod === PaymentMethod.STOCK;
                        const isEditingName = editingNameId === uniqueItemId;
                        const isEditingPrice = editingPriceId === uniqueItemId;

                        return (
                            <li key={uniqueItemId} className="flex items-center group py-0.5" draggable={!isEditingName && !isEditingPrice} onDragStart={(e) => onDragItemStart(e, item, order.id)}>
                                <div className="flex-grow truncate pr-2">
                                    {isEditingName ? (
                                        <input 
                                            type="text" 
                                            defaultValue={item.name} 
                                            autoFocus 
                                            onBlur={(e) => handleItemNameSave(item, e.target.value)} 
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} 
                                            className="bg-gray-700 text-white p-0 w-full rounded outline-none"
                                        />
                                    ) : (
                                        <span onClick={() => setEditingNameId(uniqueItemId)} className="truncate cursor-pointer hover:text-white">{item.name}</span>
                                    )}
                                </div>
                                <div className="flex items-center space-x-1 ml-1 flex-shrink-0">
                                    {isStockMovement && (
                                        order.supplierName === SupplierName.STOCK_OUT 
                                        ? <span className="font-semibold text-yellow-400">out</span>
                                        : <span className="font-semibold text-green-400">in</span>
                                    )}
                                    <div className="w-12 text-right">
                                        <span className="text-right w-12 cursor-pointer hover:bg-gray-700 p-1 -m-1 rounded-md" onClick={() => onQuantityClick(order, item)}>
                                            {item.quantity}{item.unit}
                                        </span>
                                    </div>
                                    <div className="w-16 text-right">
                                        {isEditingPrice ? (
                                            <input 
                                                type="text" 
                                                inputMode="decimal" 
                                                defaultValue={totalPrice > 0 ? totalPrice.toFixed(2) : ''} 
                                                autoFocus 
                                                onBlur={(e) => handleSaveInlinePrice(item, e.target.value)} 
                                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} 
                                                className={`bg-gray-700 p-0 w-16 text-right rounded outline-none font-mono ${isKaliOrder ? 'text-purple-300' : 'text-cyan-300'}`}
                                            />
                                        ) : (
                                            <span onClick={() => setEditingPriceId(uniqueItemId)} className={`font-mono text-right w-16 cursor-pointer hover:bg-gray-700 p-1 -m-1 rounded-md ${isKaliOrder ? 'text-purple-300' : 'text-cyan-300'}`}>
                                                {totalPrice > 0 ? totalPrice.toFixed(2) : '-'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                    {(singleColumn === 'dispatch' || singleColumn === 'on_the_way') && (
                        <li className="mt-2">
                            <button 
                                onClick={() => onAddModalOpen(order)} 
                                className="text-left text-gray-500 hover:text-white hover:bg-gray-700/50 text-sm p-1 pl-2 rounded-md w-full transition-colors flex items-center"
                            >
                                <span className="mr-1">+</span> Add item
                            </button>
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default React.memo(ManagerOrderRow);
