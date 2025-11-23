import React, { useContext, useState, useMemo, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { Order, OrderStatus, PaymentMethod, Supplier, OrderItem, Unit, Item, ItemPrice, SupplierName, StoreName } from '../types';
import ContextMenu from './ContextMenu';
import AddSupplierModal from './modals/AddSupplierModal';
import PaymentMethodModal from './modals/PaymentMethodModal';
import NumpadModal from './modals/NumpadModal';
import PriceNumpadModal from './modals/PriceNumpadModal';
import AddItemModal from './modals/AddItemModal';
import { generateOrderMessage } from '../utils/messageFormatter';
import { sendOrderToSupplierOnTelegram } from '../services/telegramService';
import { useNotifier } from '../context/NotificationContext';
import { getLatestItemPrice } from '../utils/messageFormatter';
import { stringToColorClass } from '../constants';

interface SupplierCardProps {
  order: Order;
  isManagerView?: boolean;
  onItemDrop: (destinationOrderId: string) => void;
  showStoreName?: boolean;
}

const SupplierCard: React.FC<SupplierCardProps> = ({ order, onItemDrop, showStoreName }) => {
    const { state, dispatch, actions } = useContext(AppContext);
    const { notify } = useNotifier();
    const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; options: any[] } | null>(null);
    const [isChangeSupplierModalOpen, setChangeSupplierModalOpen] = useState(false);
    const [isPaymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    
    // Long press refs
    const longPressTimer = useRef<number | null>(null);
    const isLongPress = useRef(false);
    
    const [activeUniqueItemId, setActiveUniqueItemId] = useState<string | null>(null);
    const [editingNameUniqueId, setEditingNameUniqueId] = useState<string | null>(null);
    const [editingPriceUniqueId, setEditingPriceUniqueId] = useState<string | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    // State for item modals
    const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
    const [isNumpadOpen, setNumpadOpen] = useState(false);
    const [isPriceNumpadOpen, setIsPriceNumpadOpen] = useState(false);
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);

    const handleCardDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.dataTransfer.setData('application/vnd.kalisystem.order-id', order.id);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
          dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: order.id });
        }, 0);
    };

    const handleCardDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: null });
    };

    const handleItemDragStart = (e: React.DragEvent<HTMLDivElement>, item: OrderItem) => {
        e.stopPropagation();
        e.dataTransfer.setData('application/vnd.kalisystem.item-id', item.itemId);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            dispatch({ type: 'SET_DRAGGED_ITEM', payload: { item, sourceOrderId: order.id } });
        }, 0);
    };

    const handleItemDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        dispatch({ type: 'SET_DRAGGED_ITEM', payload: null });
    };

    const handleCardDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        let canDrop = false;
        if (state.draggedItem && state.draggedItem.sourceOrderId !== order.id) {
            canDrop = true;
        } else if (state.draggedOrderId && state.draggedOrderId !== order.id) {
            canDrop = true;
        }
        
        if (canDrop) {
            e.preventDefault();
            setIsDragOver(true);
        }
    };

    const handleCardDragLeave = () => {
        setIsDragOver(false);
    };

    const handleCardDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);

        if (state.draggedItem) {
            onItemDrop(order.id);
        } else if (state.draggedOrderId) {
            actions.mergeOrders(state.draggedOrderId, order.id);
        }
        
        dispatch({ type: 'SET_DRAGGED_ITEM', payload: null });
        dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: null });
    };

    const supplier = useMemo(() => state.suppliers.find(s => s.id === order.supplierId), [state.suppliers, order.supplierId]);
    const cardTotal = useMemo(() => {
        // Always calculate total, but we might hide it in UI if dispatching
        return order.items.reduce((total, item) => {
            if (item.isSpoiled) return total;
            const latestPriceInfo = getLatestItemPrice(item.itemId, order.supplierId, state.itemPrices);
            const price = item.price ?? latestPriceInfo?.price ?? 0;
            return total + (price * item.quantity);
        }, 0);
    }, [order, state.itemPrices]);

    const handleChangeSupplier = async (newSupplier: Supplier) => {
        setIsProcessing(true);
        try {
            let supplierToUse = newSupplier;
            if (newSupplier.id.startsWith('new_')) {
                const newSupplierFromDb = await actions.addSupplier({ name: newSupplier.name });
                supplierToUse = newSupplierFromDb;
            }
            await actions.updateOrder({ ...order, supplierId: supplierToUse.id, supplierName: supplierToUse.name, paymentMethod: supplierToUse.paymentMethod });
        } finally {
            setIsProcessing(false);
            setChangeSupplierModalOpen(false);
        }
    };

    const handleHeaderActionsClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const options = [
            { label: 'Change Supplier', action: () => setChangeSupplierModalOpen(true) },
            { label: 'Drop', action: () => actions.deleteOrder(order.id), isDestructive: true },
        ];
        
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setContextMenu({ x: rect.left, y: rect.bottom + 5, options });
    };
    
    const handlePaymentMethodChange = async (newMethod: PaymentMethod) => {
        setIsProcessing(true);
        try {
            await actions.updateOrder({ ...order, paymentMethod: newMethod });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteItem = async (itemToDelete: OrderItem) => {
        await actions.deleteItemFromOrder(itemToDelete, order.id);
    };

    const handleQuantityOrPriceClick = (e: React.MouseEvent, item: OrderItem) => {
        e.stopPropagation();
        setSelectedItem(item);
        setNumpadOpen(true);
    };
    
    const handleSaveInlinePrice = async (itemToUpdate: OrderItem, totalPriceStr: string) => {
      setEditingPriceUniqueId(null);

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
  
      if (newTotalPrice !== null && newTotalPrice > 1000) {
          newTotalPrice = newTotalPrice / 4000;
      }
  
      if (newTotalPrice === null) {
          // Clear price override
          const { price, ...itemWithoutPrice } = itemToUpdate;
          if (itemToUpdate.price !== undefined) {
              const updatedItems = order.items.map(i => 
                  (i.itemId === itemToUpdate.itemId && i.isSpoiled === itemToUpdate.isSpoiled) ? itemWithoutPrice : i
              );
              await actions.updateOrder({ ...order, items: updatedItems });
          }
          return;
      }

      if (itemToUpdate.quantity === 0) { notify('Cannot set price for item with quantity 0.', 'error'); return; }

      if (!isNaN(newTotalPrice) && newTotalPrice >= 0) {
          const newUnitPrice = newTotalPrice / itemToUpdate.quantity;
          const updatedItems = order.items.map(i => 
              (i.itemId === itemToUpdate.itemId && i.isSpoiled === itemToUpdate.isSpoiled) ? { ...i, price: newUnitPrice } : i
          );
          await actions.updateOrder({ ...order, items: updatedItems });
      } else {
          notify('Invalid price.', 'error');
      }
    };

    const handleSaveName = async (itemToUpdate: OrderItem, newName: string) => {
        setEditingNameUniqueId(null);
        const trimmedName = newName.trim();
        if (!trimmedName || trimmedName === itemToUpdate.name) return;

        const updatedItems = order.items.map(i => 
            (i.itemId === itemToUpdate.itemId && i.isSpoiled === itemToUpdate.isSpoiled) 
            ? { ...i, name: trimmedName } 
            : i
        );
        await actions.updateOrder({ ...order, items: updatedItems });
    };

    const handleSaveQuantity = async (quantity: number, unit?: Unit) => {
        if (selectedItem) {
            const updatedItems = order.items.map(i => 
                (i.itemId === selectedItem.itemId && i.isSpoiled === selectedItem.isSpoiled) 
                ? { ...i, quantity, unit: unit || i.unit } 
                : i
            );
            await actions.updateOrder({ ...order, items: updatedItems });
            setSelectedItem(null);
            setNumpadOpen(false);
        }
    };

    const handleSavePrice = async (price: number, unit: Unit) => {
        if (selectedItem) {
            const updatedItems = order.items.map(i => 
                (i.itemId === selectedItem.itemId && i.isSpoiled === selectedItem.isSpoiled) 
                ? { ...i, price, unit } 
                : i
            );
            await actions.updateOrder({ ...order, items: updatedItems });
            setSelectedItem(null);
            setIsPriceNumpadOpen(false);
        }
    };

    const handleAddItem = async (item: Item) => {
        const existingItemIndex = order.items.findIndex(i => i.itemId === item.id && !i.isSpoiled);
        
        let newItems;
        if (existingItemIndex > -1) {
            newItems = [...order.items];
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
                isNew: order.status === OrderStatus.ON_THE_WAY,
            };
            newItems = [...order.items, newItem];
        }
        await actions.updateOrder({ ...order, items: newItems });
        notify(`Added ${item.name}`, 'success');
    };

    // --- Telegram Functions ---

    const handleLongPressAction = async () => {
        await actions.updateOrder({ ...order, status: OrderStatus.ON_THE_WAY, isSent: true });
        notify(`Order for ${order.supplierName} moved to 'On the Way'.`, 'success');
        
        const plainTextMessage = generateOrderMessage(order, 'plain', state.suppliers, state.stores, state.settings);
        try {
            await navigator.clipboard.writeText(plainTextMessage);
            notify('Order message copied!', 'success');
        } catch (err) {
            console.error("Failed to copy message:", err);
            notify('Failed to copy message.', 'error');
        }
    };
    
    const handlePressStart = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        
        e.stopPropagation(); // Prevent drag or other parent interactions
        
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
        
        isLongPress.current = false;
        longPressTimer.current = window.setTimeout(() => {
            isLongPress.current = true;
            longPressTimer.current = null;
            handleLongPressAction();
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
    };

    const handlePressEnd = (e: React.PointerEvent) => {
        e.stopPropagation();
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleTelegramClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLongPress.current) {
            isLongPress.current = false;
            return;
        }
        handleSendToTelegram();
    };

    const handleSendToTelegram = async () => {
        const { settings, suppliers, stores } = state;
        if (!supplier) {
             notify('Supplier not found.', 'error');
             return;
        }
        if (!supplier.chatId || !settings.telegramBotToken) {
            notify('Supplier Chat ID or Bot Token is not configured. Cannot send message.', 'error');
            return;
        }
        
        setIsProcessing(true);
        try {
            const message = generateOrderMessage(order, 'html', suppliers, stores, settings);
            await sendOrderToSupplierOnTelegram(order, supplier, message, settings.telegramBotToken);
            notify(`Order sent to ${order.supplierName}.`, 'success');
            
            if (order.status === OrderStatus.DISPATCHING) {
                await actions.updateOrder({ ...order, isSent: true, status: OrderStatus.ON_THE_WAY });
            }
        } catch (error: any) {
            notify(error.message || 'Failed to send.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // Modified condition: show button based on status only, ignoring chat ID presence
    const canSendTelegram = (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY);
    const isKaliOrder = order.supplierName === SupplierName.KALI || order.paymentMethod === PaymentMethod.KALI;
    
    // *** NEW LOGIC: Check for stock movement indicators ***
    const isStockOut = order.supplierName === SupplierName.STOCK_OUT;
    const isStockIn = order.store === StoreName.STOCK02 && order.supplierName !== SupplierName.STOCK_OUT;

    const paymentBadgeClasses = useMemo(() => {
        switch (order.paymentMethod) {
            case PaymentMethod.KALI: return 'bg-purple-500/10 text-purple-300 border-purple-500/30 hover:bg-purple-500/20';
            case PaymentMethod.CASH: return 'bg-green-500/10 text-green-300 border-green-500/30 hover:bg-green-500/20';
            case PaymentMethod.ABA: return 'bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/20';
            case PaymentMethod.STOCK: return 'bg-gray-600/50 text-gray-300 border-gray-500/30 hover:bg-gray-600';
            case PaymentMethod.MISHA: return 'bg-orange-500/10 text-orange-300 border-orange-500/30 hover:bg-orange-500/20';
            default: return 'bg-gray-700/50 text-gray-400 border-gray-600/50 hover:bg-gray-700';
        }
    }, [order.paymentMethod]);

    return (
        <>
            <div 
                ref={cardRef}
                draggable
                onDragStart={handleCardDragStart}
                onDragEnd={handleCardDragEnd}
                onDragOver={handleCardDragOver}
                onDragLeave={handleCardDragLeave}
                onDrop={handleCardDrop}
                className={`relative bg-gray-800 rounded-xl shadow-lg border transition-all duration-200 
                    ${isDragOver ? 'border-indigo-500 ring-2 ring-indigo-500 ring-opacity-50' : 'border-gray-700'}
                    ${state.draggedOrderId === order.id ? 'opacity-50' : 'opacity-100'}
                `}
            >
                {/* Header */}
                <div className="p-3 flex justify-between items-center">
                    <div className="flex-grow min-w-0 mr-2 cursor-pointer flex items-center overflow-hidden" onClick={() => setIsManuallyCollapsed(!isManuallyCollapsed)}>
                        {showStoreName && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide mr-2 flex-shrink-0 border ${stringToColorClass(order.store)}`}>
                                {order.store}
                            </span>
                        )}
                        <h3 className={`text-sm font-bold truncate mr-2 ${isKaliOrder ? 'text-purple-400' : 'text-white'}`}>
                            {order.supplierName}
                        </h3>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setPaymentMethodModalOpen(true); }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex-shrink-0 flex items-center space-x-1 border transition-colors ${paymentBadgeClasses}`}
                        >
                            <span>{order.paymentMethod || 'PAYMENT'}</span>
                            {cardTotal > 0 && (
                                <>
                                    <span className="opacity-40">|</span>
                                    <span>{cardTotal.toFixed(2)}</span>
                                </>
                            )}
                        </button>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                        {canSendTelegram && (
                            <button
                                onClick={handleTelegramClick}
                                onPointerDown={handlePressStart}
                                onPointerUp={handlePressEnd}
                                onPointerLeave={handlePressEnd}
                                onPointerCancel={handlePressEnd}
                                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                disabled={isProcessing}
                                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors duration-200 flex-shrink-0 select-none ${
                                    order.isSent ? 'text-gray-500 hover:bg-gray-700' : 'text-blue-400 hover:bg-blue-500/20 hover:text-blue-300'
                                } ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
                                aria-label="Send to Telegram"
                                title="Click: Send & Move | Long-press: Move & Copy"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.51.71l-4.84-3.56-2.22 2.15c-.22.21-.4.33-.7.33z"></path>
                                </svg>
                            </button>
                        )}
                        <button 
                            onClick={handleHeaderActionsClick}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-700 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Items List */}
                {!isManuallyCollapsed && (
                    <div className="px-3 pb-3 space-y-1">
                        {order.items.map(item => {
                            const uniqueItemId = `${item.itemId}-${item.isSpoiled ? 'spoiled' : 'clean'}`;
                            const latestPriceInfo = getLatestItemPrice(item.itemId, order.supplierId, state.itemPrices);
                            const unitPrice = item.price ?? latestPriceInfo?.price ?? 0;
                            const totalPrice = unitPrice * item.quantity;
                            const isEditingPrice = editingPriceUniqueId === uniqueItemId;
                            const isEditingName = editingNameUniqueId === uniqueItemId;
                            const isActive = activeUniqueItemId === uniqueItemId;

                            return (
                                <div 
                                    key={uniqueItemId} 
                                    className={`flex items-center justify-between text-sm py-1 group transition-colors duration-200 ${isActive ? 'bg-gray-700/50 -mx-2 px-2 rounded my-0.5' : ''}`}
                                    onClick={() => setActiveUniqueItemId(prev => prev === uniqueItemId ? null : uniqueItemId)}
                                >
                                    {isActive && (
                                        <div 
                                            className="mr-2 cursor-grab text-gray-400 hover:text-white flex-shrink-0"
                                            draggable
                                            onDragStart={(e) => handleItemDragStart(e, item)}
                                            onDragEnd={handleItemDragEnd}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                                        </div>
                                    )}

                                    <div 
                                        className="flex-grow min-w-0 flex items-center"
                                    >
                                        {isEditingName ? (
                                            <input 
                                                type="text"
                                                autoFocus
                                                defaultValue={item.name}
                                                onBlur={(e) => handleSaveName(item, e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full bg-gray-900 text-white border border-blue-500 rounded px-1 outline-none"
                                            />
                                        ) : (
                                            <span 
                                                className={`truncate cursor-pointer hover:text-white ${item.isSpoiled ? 'line-through text-red-400' : 'text-gray-300'}`}
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    if (isActive) {
                                                        setEditingNameUniqueId(uniqueItemId); 
                                                    } else {
                                                        setActiveUniqueItemId(uniqueItemId); 
                                                    }
                                                }}
                                            >
                                                {item.name}
                                            </span>
                                        )}
                                        {item.isNew && <span className="ml-2 w-2 h-2 bg-lime-500 rounded-full flex-shrink-0"></span>}
                                    </div>
                                    
                                    <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                                        {/* STOCK INDICATORS - UPDATED COLORS */}
                                        {isStockOut && <span className="text-[9px] bg-yellow-900 text-yellow-200 px-1 rounded">OUT</span>}
                                        {isStockIn && <span className="text-[9px] bg-cyan-900 text-cyan-200 px-1 rounded">IN</span>}

                                        <button 
                                            onClick={(e) => handleQuantityOrPriceClick(e, item)}
                                            className="text-gray-400 hover:text-white tabular-nums"
                                        >
                                            {item.quantity} <span className="text-xs text-gray-500">{item.unit}</span>
                                        </button>
                                        
                                        {isEditingPrice ? (
                                            <input 
                                                type="text"
                                                inputMode="decimal"
                                                autoFocus
                                                defaultValue={totalPrice > 0 ? totalPrice.toFixed(2) : ''}
                                                onBlur={(e) => handleSaveInlinePrice(item, e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-16 bg-gray-900 text-right text-white rounded border border-indigo-500 px-1 py-0.5 outline-none text-xs font-mono"
                                            />
                                        ) : (
                                            <span 
                                                onClick={(e) => { e.stopPropagation(); setEditingPriceUniqueId(uniqueItemId); }}
                                                className={`w-14 text-right cursor-pointer font-mono text-xs ${totalPrice > 0 ? (isKaliOrder ? 'text-purple-300' : 'text-cyan-300') : 'text-gray-600'}`}
                                            >
                                                {totalPrice > 0 ? totalPrice.toFixed(2) : '-'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {(order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY) && (
                            <button 
                                onClick={() => setIsAddItemModalOpen(true)}
                                className="w-full text-left text-xs text-gray-500 hover:text-indigo-400 hover:bg-gray-700/30 py-1.5 px-2 rounded transition-colors mt-2 flex items-center"
                            >
                                <span className="mr-1">+</span> Add item
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            <AddSupplierModal 
                isOpen={isChangeSupplierModalOpen} 
                onClose={() => setChangeSupplierModalOpen(false)} 
                onSelect={handleChangeSupplier} 
                title="Change Supplier"
            />
            <PaymentMethodModal
                isOpen={isPaymentMethodModalOpen}
                onClose={() => setPaymentMethodModalOpen(false)}
                onSelect={handlePaymentMethodChange}
                order={order}
            />
            {selectedItem && isNumpadOpen && (
                <NumpadModal 
                    item={selectedItem} 
                    isOpen={isNumpadOpen} 
                    onClose={() => setNumpadOpen(false)} 
                    onSave={handleSaveQuantity} 
                    onDelete={() => handleDeleteItem(selectedItem)}
                />
            )}
            {selectedItem && isPriceNumpadOpen && (
                <PriceNumpadModal
                    item={selectedItem}
                    supplierId={order.supplierId}
                    isOpen={isPriceNumpadOpen}
                    onClose={() => setIsPriceNumpadOpen(false)}
                    onSave={handleSavePrice}
                />
            )}
            {isAddItemModalOpen && (
                <AddItemModal 
                    isOpen={isAddItemModalOpen} 
                    onClose={() => setIsAddItemModalOpen(false)} 
                    onItemSelect={handleAddItem}
                    order={order}
                />
            )}
            {contextMenu && (
                <ContextMenu 
                    x={contextMenu.x} 
                    y={contextMenu.y} 
                    options={contextMenu.options} 
                    onClose={() => setContextMenu(null)} 
                />
            )}
        </>
    );
};

export default SupplierCard;