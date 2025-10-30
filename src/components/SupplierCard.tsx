

import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { Order, OrderItem, OrderStatus, Unit } from '../types';
import NumpadModal from './modals/NumpadModal';
import AddItemModal from './modals/AddItemModal';
import ContextMenu from './ContextMenu';
import { useToasts } from '../context/ToastContext';
import ConfirmationModal from './modals/ConfirmationModal';
import { sendTelegramMessage } from '../services/telegramService';

interface SupplierCardProps {
  order: Order;
  isManagerView?: boolean;
  isCollapsedByDrag?: boolean;
  onItemDragStart?: () => void;
  onItemDragEnd?: () => void;
}

const SupplierCard: React.FC<SupplierCardProps> = ({ order, isManagerView = false, isCollapsedByDrag = false, onItemDragStart, onItemDragEnd }) => {
    const { state, dispatch, actions } = useContext(AppContext);
    const { addToast } = useToasts();
    const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
    const [isNumpadOpen, setNumpadOpen] = useState(false);
    const [isAddItemModalOpen, setAddItemModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, options: { label: string; action: () => void; isDestructive?: boolean; }[] } | null>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const longPressTimer = useRef<number | null>(null);
    const wasLongPressed = useRef(false);
    const supplierLongPressTimer = useRef<number | null>(null);

    const handleItemClick = (item: OrderItem) => {
        if (wasLongPressed.current) return;
        if (isManagerView) return;
        if (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY) {
          setSelectedItem(item);
          setNumpadOpen(true);
        }
    };

    const handleSpoilItem = async (item: OrderItem) => {
        setIsProcessing(true);
        try {
            const isNowSpoiled = !item.isSpoiled;
            await actions.updateOrder({ 
                ...order, 
                items: order.items.map(i => i.itemId === item.itemId ? { ...i, isSpoiled: isNowSpoiled } : i) 
            });
            addToast(`${item.name} marked as ${isNowSpoiled ? 'spoiled' : 'not spoiled'}.`, 'info');
            setContextMenu(null);
        } catch (error) {
            console.error("Failed to spoil item:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleItemPressStart = (item: OrderItem) => {
        if (order.status !== OrderStatus.ON_THE_WAY || isManagerView) return;
        
        wasLongPressed.current = false;
        longPressTimer.current = window.setTimeout(() => {
            wasLongPressed.current = true;
            handleSpoilItem(item);
        }, 500); // 500ms for long press
    };

    const handleItemPressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
    };


    const handleSaveItem = async (quantity: number, unit?: Unit) => {
        if (!selectedItem) return;
        setIsProcessing(true);
        try {
            const newItems = order.items.map(item => item.itemId === selectedItem.itemId ? { ...item, quantity, unit } : item);
            await actions.updateOrder({ ...order, items: newItems });
            setNumpadOpen(false);
            setSelectedItem(null);
        } catch (error) {
            console.error("Failed to save item:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddItem = async (item: OrderItem) => {
        setIsProcessing(true);
        try {
            const existingItem = order.items.find(i => i.itemId === item.itemId);
            const newItems = existingItem
                ? order.items.map(i => i.itemId === existingItem.itemId ? { ...i, quantity: i.quantity + item.quantity } : i)
                : [...order.items, item];
            
            await actions.updateOrder({ ...order, items: newItems });
            addToast(`Added ${item.name}`, 'success');
        } catch (error) {
            console.error("Failed to add item:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteItem = async (item: OrderItem) => {
        setIsProcessing(true);
        try {
            const newItems = order.items.filter(i => i.itemId !== item.itemId);
            await actions.updateOrder({ ...order, items: newItems });
            setContextMenu(null);
        } catch (error) {
            console.error("Failed to delete item:", error);
        } finally {
            setIsProcessing(false);
        }
    }
    
    const handleSendOrder = async () => {
        setIsProcessing(true);
        try {
            await actions.updateOrder({ ...order, status: OrderStatus.ON_THE_WAY, isSent: true });
        } catch (error) {
            console.error("Failed to send order:", error);
        } finally {
            setIsProcessing(false);
        }
    }

    const handleUnsendOrder = async () => {
        setIsProcessing(true);
        try {
            await actions.updateOrder({ ...order, status: OrderStatus.DISPATCHING, isSent: false });
        } catch (error) {
            console.error("Failed to un-send order:", error);
        } finally {
            setIsProcessing(false);
        }
    }

    const handleMarkAsReceived = async () => {
        setIsProcessing(true);
        try {
            const spoiledItems = order.items.filter(item => item.isSpoiled);
            const receivedItems = order.items.filter(item => !item.isSpoiled);

            // Update the current order to completed, but only with the items that were actually received.
            await actions.updateOrder({ 
                ...order, 
                items: receivedItems,
                status: OrderStatus.COMPLETED, 
                isReceived: true, 
                completedAt: new Date().toISOString() 
            });

            // If there were any spoiled items, create a new dispatching order for them.
            if (spoiledItems.length > 0) {
                const supplier = state.suppliers.find(s => s.id === order.supplierId);
                if (supplier) {
                    // Create new order with spoiled items, resetting their spoiled status.
                    await actions.addOrder(
                        supplier,
                        order.store,
                        spoiledItems.map(item => ({ ...item, isSpoiled: false }))
                    );
                    addToast(`Re-ordering ${spoiledItems.length} spoiled item(s).`, 'success');
                }
            }
        } catch (error) {
            console.error("Failed to mark order as received:", error);
        } finally {
            setIsProcessing(false);
        }
    }

    const handleItemContextMenu = (e: React.MouseEvent | React.TouchEvent, item: OrderItem) => {
        e.preventDefault();
        const options: { label: string; action: () => void; isDestructive?: boolean; }[] = [];
        
        if (isManagerView && order.status === OrderStatus.ON_THE_WAY) {
             options.push({ label: item.isSpoiled ? 'Mark as Not Spoiled' : 'Mark as Spoiled', action: () => handleSpoilItem(item) });
        }
        
        if (canEditCard) {
            options.push({ label: 'Delete Item', action: () => handleDeleteItem(item), isDestructive: true });
        }

        if (options.length > 0) {
            const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
            const pageY = 'touches' in e ? e.touches[0].pageY : e.pageY;
            setContextMenu({ x: pageX, y: pageY, options });
        }
    };

    const handleDeleteOrder = () => {
        setConfirmDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        setIsProcessing(true);
        try {
            await actions.deleteOrder(order.id);
        } catch (error) {
            console.error("Failed to delete order:", error);
        } finally {
            // This is important for when the delete fails, so the spinner goes away.
            // If it succeeds, the component unmounts and this doesn't matter.
            setIsProcessing(false);
        }
    };
    
    const handleSupplierPressStart = () => {
        if (order.status !== OrderStatus.DISPATCHING || isManagerView) return;
        
        supplierLongPressTimer.current = window.setTimeout(() => {
            handleDeleteOrder();
        }, 500); // 500ms for long press
    };

    const handleSupplierPressEnd = () => {
        if (supplierLongPressTimer.current) {
            clearTimeout(supplierLongPressTimer.current);
            supplierLongPressTimer.current = null;
        }
    };

    const handleCopyOrderMessage = () => {
        const plainTextMessage = `#️⃣ Order ${order.orderId}\n🚚 Delivery order\n📌 ${order.store}\n\n` + 
            order.items.map(item => {
                const unitText = item.unit ? ` ${item.unit}` : '';
                return `${item.name} x${item.quantity}${unitText}`;
            }).join('\n');
    
        navigator.clipboard.writeText(plainTextMessage).then(() => {
            addToast('Order copied to clipboard!', 'success');
        });
    };
    
    const handleSendTelegram = async () => {
        const supplier = state.suppliers.find(s => s.id === order.supplierId);
        if (!state.settings.telegramToken || !supplier?.telegramGroupId) {
            addToast('Telegram is not configured for this supplier.', 'error');
            return;
        }
    
        setIsProcessing(true);
        try {
            const message = `#️⃣ Order ${order.orderId}\n` + 
                `🚚 Delivery order\n` + 
                `📌 ${order.store}\n\n` + 
                order.items.map(item => {
                    const unitText = item.unit ? ` ${item.unit}` : '';
                    return `${item.name} x${item.quantity}${unitText}`;
                }).join('\n');
                
            const success = await sendTelegramMessage({
                botToken: state.settings.telegramToken,
                chatId: supplier.telegramGroupId,
                text: message,
            });
    
            if (success) {
                addToast('Order sent to Telegram!', 'success');
            } else {
                 addToast('Failed to send to Telegram.', 'error');
            }
        } catch (error) {
            addToast('Failed to send order to Telegram.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // Drag and Drop handlers
    const handleDragStart = (e: React.DragEvent, item: OrderItem) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ sourceOrderId: order.id, item }));
        setTimeout(() => {
            onItemDragStart?.();
        }, 0);
    };
    
    const handleDragEnd = () => {
        onItemDragEnd?.();
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (order.status === OrderStatus.DISPATCHING && !isManagerView) {
            setIsDraggingOver(true);
        }
    };

    const handleDragLeave = () => {
        setIsDraggingOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOver(false);
        onItemDragEnd?.();
    
        if (order.status !== OrderStatus.DISPATCHING || isManagerView) return;
    
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const { sourceOrderId, item } = data as { sourceOrderId: string, item: OrderItem };
    
            if (sourceOrderId !== order.id) {
                addToast(`Moving items between orders is not fully connected to the database yet.`, 'info');
            }
        } catch (error) {
            console.error("Drop failed:", error);
            addToast(`Drop failed: ${error}`, 'error');
        }
    };
    
    const supplier = state.suppliers.find(s => s.id === order.supplierId);
    const canSendTelegram = !!state.settings.telegramToken && !!supplier?.telegramGroupId;
    const isEffectivelyCollapsed = isCollapsedByDrag || isManuallyCollapsed;
    const canEditCard = !isManagerView && (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY);
    const canDragItems = !isManagerView && order.status === OrderStatus.DISPATCHING;
    const isItemInteractive = canEditCard || isManagerView;
    const showActionRow = order.status !== OrderStatus.COMPLETED;

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative bg-gray-800 rounded-xl shadow-lg flex flex-col border-t-4 transition-all duration-300
                ${order.status === OrderStatus.DISPATCHING ? 'border-blue-500' : ''}
                ${order.status === OrderStatus.ON_THE_WAY ? 'border-yellow-500' : ''}
                ${order.status === OrderStatus.COMPLETED ? 'border-green-500' : ''}
                ${isDraggingOver ? 'ring-2 ring-indigo-500' : ''}
            `}
        >
            {isProcessing && (
                <div className="absolute inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-10 rounded-xl">
                    <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            )}
            <div className="px-2 pt-2 flex justify-between items-start">
                <div
                    onMouseDown={handleSupplierPressStart}
                    onMouseUp={handleSupplierPressEnd}
                    onMouseLeave={handleSupplierPressEnd}
                    onTouchStart={handleSupplierPressStart}
                    onTouchEnd={handleSupplierPressEnd}
                    className="p-1 -m-1 rounded-md transition-all active:ring-2 active:ring-indigo-500 cursor-pointer"
                >
                    <h3 className="font-bold text-white text-lg select-none">{order.supplierName}</h3>
                </div>
                 <div className="flex items-center space-x-1">
                    <button onClick={() => setIsManuallyCollapsed(!isManuallyCollapsed)} className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-gray-700" aria-label={isManuallyCollapsed ? 'Expand card' : 'Collapse card'}>
                        {isManuallyCollapsed ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            <div className={`flex flex-col flex-grow overflow-hidden transition-all duration-300 ease-in-out ${isEffectivelyCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}>
                <div className="flex-grow px-2 pt-2 pb-0 space-y-1 overflow-y-auto">
                    {order.items.length > 0 &&
                        order.items.map(item => (
                            <div
                                key={item.itemId}
                                onClick={() => handleItemClick(item)}
                                onContextMenu={(e) => handleItemContextMenu(e, item)}
                                onMouseDown={() => handleItemPressStart(item)}
                                onMouseUp={handleItemPressEnd}
                                onMouseLeave={handleItemPressEnd}
                                onTouchStart={() => handleItemPressStart(item)}
                                onTouchEnd={handleItemPressEnd}
                                role="button"
                                tabIndex={isItemInteractive ? 0 : -1}
                                draggable={canDragItems}
                                onDragStart={(e) => canDragItems && handleDragStart(e, item)}
                                onDragEnd={() => canDragItems && handleDragEnd()}
                                className={`flex justify-between items-center px-2 py-1 rounded-md 
                                    ${isItemInteractive ? 'cursor-pointer hover:bg-gray-700' : ''}
                                    ${canDragItems ? 'cursor-grab' : ''}
                                `}
                            >
                                <span className={`text-gray-300 ${item.isSpoiled ? 'line-through text-gray-500' : ''}`}>
                                    {item.name} 
                                </span>
                                <span className="font-semibold text-white">{item.quantity}{item.unit}</span>
                            </div>
                        ))
                    }
                </div>
                
                <div className="px-2 py-1 border-t border-gray-700/50">
                    {!isManagerView && showActionRow && (
                        <div className="flex items-center space-x-2">
                           {order.status === OrderStatus.DISPATCHING && (
                             <>
                                <button onClick={() => setAddItemModalOpen(true)} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Add Item">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </button>
                                {canSendTelegram ? (
                                    <button onClick={handleSendTelegram} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Send to Telegram">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    </button>
                                ) : (
                                    <button onClick={handleDeleteOrder} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Delete Order">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-1.414 1.414a1 1 0 01-1.414 0l-1.414-1.414a1 1 0 00-.707-.293H8m12 0a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h2.586a1 1 0 00.707-.293l1.414-1.414a1 1 0 011.414 0l1.414 1.414a1 1 0 00.707.293H18" />
                                        </svg>
                                    </button>
                                )}
                                <button onClick={handleCopyOrderMessage} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Copy Order Text">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </button>
                               <div className="flex-grow"></div>
                               <button onClick={handleSendOrder} disabled={order.items.length === 0 || isProcessing} className="flex-grow bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md text-sm disabled:bg-indigo-800 disabled:cursor-not-allowed">
                                 {isProcessing ? '...' : 'Send'}
                               </button>
                             </>
                           )}
                           {order.status === OrderStatus.ON_THE_WAY && (
                             <>
                                <button onClick={handleUnsendOrder} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Unsend">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                    </svg>
                                </button>
                                <button onClick={() => setAddItemModalOpen(true)} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Add Item">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </button>
                                <button onClick={handleCopyOrderMessage} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Copy Order Text">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </button>
                                <div className="flex-grow"></div>
                                <button onClick={handleMarkAsReceived} disabled={isProcessing} className="flex-grow bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md text-sm disabled:bg-green-800 disabled:cursor-not-allowed">
                                    {isProcessing ? '...' : 'Received'}
                                </button>
                             </>
                           )}
                        </div>
                    )}
                </div>
            </div>
            {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
            {isNumpadOpen && selectedItem && (
                <NumpadModal item={selectedItem} isOpen={isNumpadOpen} onClose={() => setNumpadOpen(false)} onSave={handleSaveItem} />
            )}
            {isAddItemModalOpen && (
                <AddItemModal order={order} isOpen={isAddItemModalOpen} onClose={() => setAddItemModalOpen(false)} onAddItem={handleAddItem} />
            )}
            <ConfirmationModal
                isOpen={isConfirmDeleteOpen}
                onClose={() => setConfirmDeleteOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Order"
                message={`Are you sure you want to delete the order for ${order.supplierName}? This action cannot be undone.`}
                confirmText="Delete"
                isDestructive={true}
            />
        </div>
    );
};

export default SupplierCard;