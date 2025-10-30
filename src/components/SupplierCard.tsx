import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Order, OrderItem, OrderStatus, Unit, Item, SupplierName } from '../types';
import NumpadModal from './modals/NumpadModal';
import AddItemModal from './modals/AddItemModal';
import ContextMenu from './ContextMenu';
import { useToasts } from '../context/ToastContext';
import ConfirmationModal from './modals/ConfirmationModal';
import { sendOrderToSupplierOnTelegram } from '../services/telegramService';
import EditItemModal from './modals/EditItemModal';

interface SupplierCardProps {
  order: Order;
  isManagerView?: boolean;
  draggedItem?: { item: OrderItem; sourceOrderId: string } | null;
  setDraggedItem?: (item: { item: OrderItem; sourceOrderId: string } | null) => void;
  onItemDrop?: (destinationOrderId: string) => void;
  showStoreName?: boolean;
}

const escapeHtml = (text: string): string => {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const generateOrderMessage = (order: Order, format: 'plain' | 'html'): string => {
    const isHtml = format === 'html';

    if (order.supplierName === SupplierName.KALI) {
        return (isHtml ? `<b>${escapeHtml(order.store)}</b>` : order.store) + '\n' +
            order.items.map(item => {
                const unitText = item.unit ? (isHtml ? escapeHtml(item.unit) : item.unit) : '';
                const itemName = isHtml ? escapeHtml(item.name) : item.name;
                return `${itemName} x${item.quantity}${unitText}`;
            }).join('\n');
    }

    const header = isHtml
        ? `<b>#️⃣ Order ${escapeHtml(order.orderId)}</b>\n🚚 Delivery order\n📌 <b>${escapeHtml(order.store)}</b>\n\n`
        : `#️⃣ Order ${order.orderId}\n🚚 Delivery order\n📌 ${order.store}\n\n`;

    return header + order.items.map(item => {
        const unitText = item.unit ? ` ${isHtml ? escapeHtml(item.unit) : item.unit}` : '';
        const itemName = isHtml ? `<i>${escapeHtml(item.name)}</i>` : item.name;
        return `${itemName} x${item.quantity}${unitText}`;
    }).join('\n');
};


const SupplierCard: React.FC<SupplierCardProps> = ({ order, isManagerView = false, draggedItem, setDraggedItem, onItemDrop, showStoreName = false }) => {
    const { state, dispatch, actions } = useContext(AppContext);
    const { addToast } = useToasts();
    const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
    const [isNumpadOpen, setNumpadOpen] = useState(false);
    const [isAddItemModalOpen, setAddItemModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, options: { label: string; action: () => void; isDestructive?: boolean; }[] } | null>(null);
    const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const supplierLongPressTimer = useRef<number | null>(null);
    
    const [isEditItemModalOpen, setEditItemModalOpen] = useState(false);
    const [selectedMasterItem, setSelectedMasterItem] = useState<Item | null>(null);
    const clickTimeout = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (clickTimeout.current) {
                clearTimeout(clickTimeout.current);
            }
        };
    }, []);

    const handleItemDoubleClick = (orderItem: OrderItem) => {
        if (isManagerView) return;
        const masterItem = state.items.find(i => i.id === orderItem.itemId);
        if (masterItem) {
            setSelectedMasterItem(masterItem);
            setEditItemModalOpen(true);
        } else {
            addToast(`Could not find master data for item "${orderItem.name}".`, 'error');
        }
    };

    const handleItemClick = (item: OrderItem) => {
        if (isManagerView) return;
        if (order.status === OrderStatus.DISPATCHING) {
            if (clickTimeout.current) {
                clearTimeout(clickTimeout.current);
                clickTimeout.current = null;
                handleItemDoubleClick(item);
                return;
            }
        }
        
        if (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY) {
            clickTimeout.current = window.setTimeout(() => {
                setSelectedItem(item);
                setNumpadOpen(true);
                clickTimeout.current = null;
            }, 250);
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
            if (newItems.length === 0 && order.status === OrderStatus.ON_THE_WAY) {
                await actions.deleteOrder(order.id);
                addToast(`Order for ${order.supplierName} removed as it became empty.`, 'success');
            } else {
                await actions.updateOrder({ ...order, items: newItems });
            }
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

            await actions.updateOrder({ 
                ...order, 
                items: receivedItems,
                status: OrderStatus.COMPLETED, 
                isReceived: true, 
                completedAt: new Date().toISOString() 
            });

            if (spoiledItems.length > 0) {
                const supplier = state.suppliers.find(s => s.id === order.supplierId);
                if (supplier) {
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
        
        if (order.status === OrderStatus.ON_THE_WAY) {
             options.push({ label: item.isSpoiled ? 'Mark as Not Spoiled' : 'Mark as Spoiled', action: () => handleSpoilItem(item) });
        }
        
        if (!isManagerView && canEditCard) {
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
            setIsProcessing(false);
        }
    };
    
    const handleSupplierPressStart = () => {
        if (order.status !== OrderStatus.DISPATCHING || isManagerView) return;
        
        supplierLongPressTimer.current = window.setTimeout(() => {
            handleDeleteOrder();
        }, 500);
    };

    const handleSupplierPressEnd = () => {
        if (supplierLongPressTimer.current) {
            clearTimeout(supplierLongPressTimer.current);
            supplierLongPressTimer.current = null;
        }
    };

    const handleCopyOrderMessage = () => {
        const plainTextMessage = generateOrderMessage(order, 'plain');
        navigator.clipboard.writeText(plainTextMessage).then(() => {
            addToast('Order copied to clipboard!', 'success');
        });
    };
    
    const handleSendTelegram = async () => {
        const supplier = state.suppliers.find(s => s.id === order.supplierId);
        const { supabaseUrl, supabaseKey, telegramToken } = state.settings;
        if (!supabaseUrl || !supabaseKey || !telegramToken || !supplier?.telegramGroupId) {
            addToast('Telegram is not configured for this supplier.', 'error');
            return;
        }
    
        setIsProcessing(true);
        try {
            const message = generateOrderMessage(order, 'html');
            await sendOrderToSupplierOnTelegram({
                url: supabaseUrl,
                key: supabaseKey,
                chatId: supplier.telegramGroupId,
                message,
            });
            addToast('Order sent to Telegram!', 'success');
        } catch (error) {
            addToast('Failed to send order to Telegram.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleShareToStore = async () => {
        setIsProcessing(true);
        try {
            const message = generateOrderMessage(order, 'html');
            await actions.sendOrderToStore(order, message);
            addToast(`Order shared with ${order.store} manager.`, 'success');
        } catch (e: any) {
            addToast(`Error: ${e.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveMasterItem = async (itemToSave: Item | Omit<Item, 'id'>) => {
        if ('id' in itemToSave) {
            await actions.updateItem(itemToSave as Item);
        } else {
            addToast('Error: Cannot save an item without an ID from this view.', 'error');
        }
    };

    const handleDeleteMasterItem = async (itemId: string) => {
        await actions.deleteItem(itemId);
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: OrderItem) => {
        e.dataTransfer.setData('text/plain', item.itemId);
        e.dataTransfer.effectAllowed = "move";
        setDraggedItem?.({ item, sourceOrderId: order.id });
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (draggedItem && draggedItem.sourceOrderId !== order.id) {
            setIsDragOver(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        if (draggedItem && draggedItem.sourceOrderId !== order.id) {
            onItemDrop?.(order.id);
        }
    };

    const supplier = state.suppliers.find(s => s.id === order.supplierId);
    const canSendTelegram = !!state.settings.telegramToken && !!supplier?.telegramGroupId;
    const canShareToStore = true; // Always allow attempting to share; backend will handle configuration.

    const isEffectivelyCollapsed = isManuallyCollapsed;
    const canEditCard = !isManagerView && (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY);
    const canAcceptDrop = isDragOver && draggedItem && draggedItem.sourceOrderId !== order.id && order.status === OrderStatus.DISPATCHING;

    return (
        <div
            onDragOver={canEditCard ? handleDragOver : undefined}
            onDragLeave={canEditCard ? handleDragLeave : undefined}
            onDrop={canEditCard ? handleDrop : undefined}
            className={`relative bg-gray-800 rounded-xl shadow-lg flex flex-col border-t-4 transition-all duration-300
                ${order.status === OrderStatus.DISPATCHING ? 'border-blue-500' : ''}
                ${order.status === OrderStatus.ON_THE_WAY ? 'border-yellow-500' : ''}
                ${order.status === OrderStatus.COMPLETED ? 'border-green-500' : ''}
                ${canAcceptDrop ? 'border-2 border-dashed border-indigo-400' : ''}
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
                    <h3 className="font-bold text-white text-lg select-none">
                        {order.supplierName}
                        {showStoreName && <span className="text-gray-400 font-medium text-base ml-2">({order.store})</span>}
                    </h3>
                </div>
                 <div className="flex items-center space-x-1">
                    <button onClick={() => setIsManuallyCollapsed(!isManuallyCollapsed)} className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-gray-700" aria-label={isManuallyCollapsed ? 'Expand card' : 'Collapse card'}>
                        {isManuallyCollapsed ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                        )}
                    </button>
                </div>
            </div>

            <div className={`flex flex-col flex-grow overflow-hidden transition-all duration-300 ease-in-out ${isEffectivelyCollapsed ? 'max-h-0 opacity-0' : 'opacity-100'}`}>
                <div className="flex-grow px-2 pt-2 pb-0 space-y-1">
                    {order.items.length > 0 &&
                        order.items.map(item => (
                            <div
                                key={item.itemId}
                                draggable={canEditCard}
                                onDragStart={(e) => handleDragStart(e, item)}
                                onDragEnd={() => setDraggedItem?.(null)}
                                onClick={() => handleItemClick(item)}
                                onContextMenu={(e) => handleItemContextMenu(e, item)}
                                role="button"
                                tabIndex={!isManagerView ? 0 : -1}
                                className={`flex justify-between items-center px-2 py-1 rounded-md 
                                    ${!isManagerView ? 'cursor-pointer hover:bg-gray-700' : ''}
                                    ${canEditCard ? 'cursor-grab active:cursor-grabbing' : ''}
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
                    {order.status !== OrderStatus.COMPLETED && (
                        <div className="flex items-center space-x-2">
                           {order.status === OrderStatus.DISPATCHING && !isManagerView && (
                             <>
                                <button onClick={() => setAddItemModalOpen(true)} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Add Item">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                </button>
                                {canSendTelegram && (
                                    <button onClick={handleSendTelegram} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Send to Telegram">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                    </button>
                                )}
                                <button onClick={handleCopyOrderMessage} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Copy Order Text">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                </button>
                                {canShareToStore && (
                                     <button onClick={handleShareToStore} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Share order with store">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                                        </svg>
                                    </button>
                                )}
                               <div className="flex-grow"></div>
                               <button onClick={handleSendOrder} disabled={order.items.length === 0 || isProcessing} className="flex-grow bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md text-sm disabled:bg-indigo-800 disabled:cursor-not-allowed">
                                 {isProcessing ? '...' : 'Send'}
                               </button>
                             </>
                           )}
                           {order.status === OrderStatus.ON_THE_WAY && (
                            <div className="w-full">
                                {isManagerView ? (
                                    <button onClick={handleMarkAsReceived} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md text-sm disabled:bg-green-800 disabled:cursor-not-allowed">
                                        {isProcessing ? '...' : 'Received'}
                                    </button>
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <button onClick={handleUnsendOrder} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Unsend">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
                                        </button>
                                        <div className="flex-grow"></div>
                                        <button onClick={handleMarkAsReceived} disabled={isProcessing} className="flex-grow bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md text-sm disabled:bg-green-800 disabled:cursor-not-allowed">
                                            {isProcessing ? '...' : 'Received'}
                                        </button>
                                    </div>
                                )}
                            </div>
                           )}
                        </div>
                    )}
                </div>
            </div>
            {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
            {isNumpadOpen && selectedItem && (
                <NumpadModal 
                    item={selectedItem} 
                    isOpen={isNumpadOpen} 
                    onClose={() => setNumpadOpen(false)} 
                    onSave={handleSaveItem}
                    onDelete={() => handleDeleteItem(selectedItem)}
                />
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
            {selectedMasterItem && isEditItemModalOpen && (
                <EditItemModal
                    item={selectedMasterItem}
                    isOpen={isEditItemModalOpen}
                    onClose={() => setEditItemModalOpen(false)}
                    onSave={handleSaveMasterItem}
                    onDelete={handleDeleteMasterItem}
                />
            )}
        </div>
    );
};

export default SupplierCard;