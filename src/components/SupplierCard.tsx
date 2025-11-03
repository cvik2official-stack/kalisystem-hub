import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Order, OrderItem, OrderStatus, Unit, Item, SupplierName, Supplier, PaymentMethod, StoreName, Store, ItemPrice } from '../types';
import NumpadModal from './modals/NumpadModal';
import AddItemModal from './modals/AddItemModal';
import ContextMenu from './ContextMenu';
import { useToasts } from '../context/ToastContext';
import ConfirmationModal from './modals/ConfirmationModal';
import EditItemModal from './modals/EditItemModal';
import { generateOrderMessage } from '../utils/messageFormatter';
import EditSupplierModal from './modals/EditSupplierModal';
import { sendOrderToSupplierOnTelegram, sendOrderUpdateToSupplierOnTelegram } from '../services/telegramService';
import AddSupplierModal from './modals/AddSupplierModal';
import MergeOrderModal from './modals/MergeOrderModal';
import PriceNumpadModal from './modals/PriceNumpadModal';
import { upsertItemPrice } from '../services/supabaseService';

interface SupplierCardProps {
  order: Order;
  isManagerView?: boolean;
  draggedItem?: { item: OrderItem; sourceOrderId: string } | null;
  setDraggedItem?: (item: { item: OrderItem; sourceOrderId: string } | null) => void;
  onItemDrop?: (destinationOrderId: string) => void;
  showStoreName?: boolean;
}

const SupplierCard: React.FC<SupplierCardProps> = ({ order, isManagerView = false, draggedItem, setDraggedItem, onItemDrop, showStoreName = false }) => {
    const { state, actions } = useContext(AppContext);
    const { addToast } = useToasts();
    const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
    const [isNumpadOpen, setNumpadOpen] = useState(false);
    const [isAddItemModalOpen, setAddItemModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, options: { label: string; action: () => void; isDestructive?: boolean; }[] } | null>(null);
    const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(order.status === OrderStatus.COMPLETED);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isEditingInvoice, setIsEditingInvoice] = useState(false);
    const [invoiceAmount, setInvoiceAmount] = useState<string>('');
    const [isChangeSupplierModalOpen, setChangeSupplierModalOpen] = useState(false);
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [isPriceNumpadOpen, setIsPriceNumpadOpen] = useState(false);
    
    const [isEditItemModalOpen, setEditItemModalOpen] = useState(false);
    const [selectedMasterItem, setSelectedMasterItem] = useState<Item | null>(null);
    const clickTimeout = useRef<number | null>(null);

    const [isEditSupplierModalOpen, setEditSupplierModalOpen] = useState(false);
    const supplier = state.suppliers.find(s => s.id === order.supplierId);

    const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
    const [editedItemPrice, setEditedItemPrice] = useState<string>('');

    useEffect(() => {
        return () => {
            if (clickTimeout.current) clearTimeout(clickTimeout.current);
        };
    }, []);

    useEffect(() => {
        if (isEditingInvoice) {
            setInvoiceAmount(order.invoiceAmount ? String(order.invoiceAmount) : '');
        }
    }, [isEditingInvoice, order.invoiceAmount]);

    const handleSaveInvoiceAmount = async () => {
        setIsProcessing(true);
        try {
            const amountStr = String(invoiceAmount).trim();
            if (amountStr === '') {
                const { invoiceAmount, ...orderWithoutAmount } = order;
                await actions.updateOrder(orderWithoutAmount as Order);
                addToast('Invoice amount cleared.', 'info');
            } else {
                const amount = parseFloat(amountStr);
                if (!isNaN(amount) && amount >= 0) {
                    await actions.updateOrder({ ...order, invoiceAmount: amount });
                    addToast('Invoice amount saved.', 'success');
                } else {
                    addToast('Invalid amount entered.', 'error');
                }
            }
        } catch (error) {
            console.error("Failed to save invoice amount:", error);
        } finally {
            setIsEditingInvoice(false);
            setIsProcessing(false);
        }
    };
    
    const handleSaveItemPrice = async (orderItem: OrderItem) => {
        setIsProcessing(true);
        try {
            const newPrice = parseFloat(editedItemPrice);
            let updatedItems;

            if (isNaN(newPrice) || editedItemPrice.trim() === '') {
                updatedItems = order.items.map(i => {
                    if (i.itemId === orderItem.itemId) {
                        const { price, ...rest } = i;
                        return rest as OrderItem;
                    }
                    return i;
                });
            } else {
                updatedItems = order.items.map(i =>
                    i.itemId === orderItem.itemId ? { ...i, price: newPrice } : i
                );
            }
            
            const newInvoiceAmount = updatedItems.reduce((total, item) => {
                return total + ((item.price || 0) * item.quantity);
            }, 0);
            
            await actions.updateOrder({ ...order, items: updatedItems, invoiceAmount: newInvoiceAmount });
            addToast(`Price updated for ${orderItem.name}.`, 'success');
            
        } catch (error) {
            console.error("Failed to save item price:", error);
        } finally {
            setEditingPriceItemId(null);
            setEditedItemPrice('');
            setIsProcessing(false);
        }
    };
    
    const handleSaveUnitPrice = async (price: number, unit: Unit, isMaster: boolean) => {
        if (!selectedItem) return;
        setIsProcessing(true);
        try {
          const itemPrice: ItemPrice = {
            itemId: selectedItem.itemId,
            supplierId: order.supplierId,
            price: price,
            unit: unit,
            isMaster: isMaster,
          };
          await upsertItemPrice({
            itemPrice,
            url: state.settings.supabaseUrl,
            key: state.settings.supabaseKey
          });
          addToast(`Price for ${selectedItem.name} set to ${price}/${unit}.`, 'success');
          setIsPriceNumpadOpen(false);
          setSelectedItem(null);
        } catch (error: any) {
          addToast(`Failed to set price: ${error.message}`, 'error');
        } finally {
          setIsProcessing(false);
        }
    };

    const handleItemClick = (e: React.MouseEvent, item: OrderItem) => {
        if (e.detail === 2) { // Double-click
            handleContextMenu(e, item);
            return;
        }

        if (clickTimeout.current) {
            clearTimeout(clickTimeout.current);
            clickTimeout.current = null;
        }
    
        clickTimeout.current = window.setTimeout(() => {
            clickTimeout.current = null;
            if (order.status === OrderStatus.COMPLETED && !isManagerView) {
                setEditingPriceItemId(item.itemId);
                setEditedItemPrice(item.price ? String(item.price) : '');
            } else if (order.status !== OrderStatus.COMPLETED && !isManagerView) {
                setSelectedItem(item);
                setNumpadOpen(true);
            }
        }, 250);
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
        } catch (error) {
            console.error("Failed to spoil item:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveItem = async (quantity: number, unit?: Unit) => {
        if (!selectedItem) return;

        const masterItem = state.items.find(i => i.id === selectedItem.itemId);
        const isUnitChangedForMaster = masterItem && unit && masterItem.unit !== unit;

        setIsProcessing(true);
        try {
            const newItems = order.items.map(item =>
                item.itemId === selectedItem.itemId ? { ...item, quantity, unit } : item
            );
            await actions.updateOrder({ ...order, items: newItems });

            if (isUnitChangedForMaster) {
                await actions.updateItem({ ...masterItem, unit: unit! });
                addToast(`Default unit for "${masterItem.name}" updated to ${unit}.`, 'info');
            }
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
            const isUpdateToSentOrder = order.status === OrderStatus.ON_THE_WAY;
            const existingItem = order.items.find(i => i.itemId === item.itemId);
            let newItems;
    
            if (existingItem) {
                newItems = order.items.map(i => 
                    i.itemId === item.itemId 
                    ? { ...i, quantity: i.quantity + item.quantity, isNew: isUpdateToSentOrder || i.isNew }
                    : i
                );
            } else {
                newItems = [...order.items, { ...item, isNew: isUpdateToSentOrder }];
            }
            
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

            for (const receivedItem of receivedItems) {
                const masterItem = state.items.find(i => i.id === receivedItem.itemId);
                if (masterItem && masterItem.trackStock) {
                    const newStockQuantity = (masterItem.stockQuantity || 0) + receivedItem.quantity;
                    await actions.updateItem({ ...masterItem, stockQuantity: newStockQuantity });
                }
            }

            await actions.updateOrder({ 
                ...order, 
                items: receivedItems,
                status: OrderStatus.COMPLETED, 
                isReceived: true, 
                completedAt: new Date().toISOString() 
            });

            if (spoiledItems.length > 0) {
                const spoiledSupplier = state.suppliers.find(s => s.id === order.supplierId);
                if (spoiledSupplier) {
                    await actions.addOrder(
                        spoiledSupplier,
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

    const handleChangeSupplier = async (newSupplier: Supplier) => {
        setIsProcessing(true);
        try {
            await actions.updateOrder({ ...order, supplierId: newSupplier.id, supplierName: newSupplier.name });
            addToast(`Order changed to ${newSupplier.name}.`, 'success');
        } finally {
            setIsProcessing(false);
            setChangeSupplierModalOpen(false);
        }
    };
    
    const handleMergeOrder = (destinationOrder: Order) => {
        actions.mergeOrders(order.id, destinationOrder.id);
        setIsMergeModalOpen(false);
    };

    const handleContextMenu = (e: React.MouseEvent | React.TouchEvent, target: 'supplier' | OrderItem) => {
        if (isManagerView && target !== 'supplier') return;
        
        e.preventDefault();
        
        const options: { label: string; action: () => void; isDestructive?: boolean; }[] = [];
        
        if (target === 'supplier') {
            if (order.status !== OrderStatus.COMPLETED) {
                options.push({ label: 'Change Supplier', action: () => setChangeSupplierModalOpen(true) });
                options.push({ label: 'Merge...', action: () => setIsMergeModalOpen(true) });
                options.push({ label: 'Drop (Cancel Order)', action: () => setConfirmDeleteOpen(true), isDestructive: true });
            }
        } else { // It's an OrderItem
            const masterItem = state.items.find(i => i.id === target.itemId);
            if (masterItem) {
                options.push({ label: 'Edit...', action: () => { setSelectedMasterItem(masterItem); setEditItemModalOpen(true); } });
            }
            options.push({ label: 'Set Unit Price...', action: () => { setSelectedItem(target); setIsPriceNumpadOpen(true); } });
            
            if (order.status !== OrderStatus.COMPLETED) {
                if (order.status === OrderStatus.ON_THE_WAY) {
                    options.push({ label: 'Spoil', action: () => handleSpoilItem(target) });
                }
                options.push({ label: 'Remove', action: () => handleDeleteItem(target), isDestructive: true });
            }
        }

        if(options.length === 0) return;

        const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
        const pageY = 'touches' in e ? e.touches[0].pageY : e.pageY;
        setContextMenu({ x: pageX, y: pageY, options });
    };

    const handleCopyOrderMessage = () => {
        navigator.clipboard.writeText(generateOrderMessage(order, 'plain')).then(() => {
            addToast('Order copied to clipboard!', 'success');
        });
    };
    
    const handleSaveMasterItem = async (itemToSave: Item | Omit<Item, 'id'>) => {
        if ('id' in itemToSave) await actions.updateItem(itemToSave as Item);
        else addToast('Error: Cannot save an item without an ID from this view.', 'error');
    };

    const handleDeleteMasterItem = async (itemId: string) => {
        await actions.deleteItem(itemId);
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: OrderItem) => {
        if (setDraggedItem) {
            e.dataTransfer.setData('text/plain', item.itemId);
            e.dataTransfer.effectAllowed = "move";
            setDraggedItem({ item, sourceOrderId: order.id });
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (draggedItem && draggedItem.sourceOrderId !== order.id) setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (onItemDrop && draggedItem && draggedItem.sourceOrderId !== order.id) {
            onItemDrop(order.id);
        }
    };

    const handleSupplierClick = () => {
        if (!isManagerView && supplier && (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY)) {
            setEditSupplierModalOpen(true);
        }
    };
    
    const handleSaveSupplier = async (updatedSupplier: Supplier) => {
        await actions.updateSupplier(updatedSupplier);
    };

    const handleSendToTelegram = async () => {
        const { telegramBotToken } = state.settings;
        if (!supplier || !supplier.chatId || !telegramBotToken) {
            addToast('Supplier Chat ID or Bot Token is not configured.', 'error');
            return;
        }
        setIsProcessing(true);
        try {
            await sendOrderToSupplierOnTelegram(order, supplier, generateOrderMessage(order, 'html'), telegramBotToken);
            addToast(`Order sent to ${order.supplierName} via Telegram.`, 'success');
            if (order.status === OrderStatus.DISPATCHING) {
                await actions.updateOrder({ ...order, status: OrderStatus.ON_THE_WAY, isSent: true });
            }
        } catch (error: any) {
            addToast(error.message || `Failed to send to ${order.supplierName}.`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSendUpdateToTelegram = async () => {
        const { telegramBotToken } = state.settings;
        if (!supplier || !supplier.chatId || !telegramBotToken) {
            addToast('Supplier Chat ID or Bot Token is not configured.', 'error');
            return;
        }
    
        const newItems = order.items.filter(item => item.isNew);
        if (newItems.length === 0) {
            addToast('No new items to send.', 'info');
            return;
        }
    
        setIsProcessing(true);
        try {
            await sendOrderUpdateToSupplierOnTelegram(order, newItems, supplier, telegramBotToken);
            const updatedItems = order.items.map(({ isNew, ...item }) => item);
            await actions.updateOrder({ ...order, items: updatedItems });
            addToast(`Update sent to ${order.supplierName}.`, 'success');
        } catch (error: any) {
            addToast(error.message || `Failed to send update to ${order.supplierName}.`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const paymentMethodBadgeColors: Record<string, string> = {
        [PaymentMethod.ABA]: 'bg-blue-500/50 text-blue-300',
        [PaymentMethod.CASH]: 'bg-green-500/50 text-green-300',
        [PaymentMethod.KALI]: 'bg-purple-500/50 text-purple-300',
        [PaymentMethod.STOCK]: 'bg-gray-500/50 text-gray-300',
    };

    const isEffectivelyCollapsed = isManuallyCollapsed || (!!draggedItem && draggedItem.sourceOrderId !== order.id);
    const canEditCard = !isManagerView && (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY);
    const showActionRow = order.status !== OrderStatus.COMPLETED;
    const canAcceptDrop = isDragOver && draggedItem && draggedItem.sourceOrderId !== order.id;
    const hasNewItems = order.status === OrderStatus.ON_THE_WAY && order.items.some(item => item.isNew);

    return (
        <div
            onDragOver={canEditCard ? handleDragOver : undefined}
            onDragLeave={canEditCard ? handleDragLeave : undefined}
            onDrop={canEditCard ? handleDrop : undefined}
            className={`relative bg-gray-800 rounded-xl shadow-lg flex flex-col border-t-4 transition-all duration-300 md:max-w-sm
                ${order.status === OrderStatus.DISPATCHING ? 'border-blue-500' : ''}
                ${order.status === OrderStatus.ON_THE_WAY ? 'border-yellow-500' : ''}
                ${order.status === OrderStatus.COMPLETED ? 'border-green-500' : ''}
                ${canAcceptDrop ? 'border-2 border-dashed border-indigo-400' : ''}
            `}
        >
            {isProcessing && (
                <div className="absolute inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-10 rounded-xl">
                    <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
            )}
            <div
              className="px-2 pt-2 flex justify-between items-start"
              onContextMenu={(e) => handleContextMenu(e, 'supplier')}
              onDoubleClick={(e) => e.stopPropagation()}
            >
                <div onClick={handleSupplierClick} className="flex-grow p-1 -m-1 rounded-md transition-all active:ring-2 active:ring-indigo-500 cursor-pointer">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white text-lg select-none">{order.supplierName}</h3>
                        <div className="flex-grow flex items-center gap-2">
                            {supplier?.paymentMethod && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${paymentMethodBadgeColors[supplier.paymentMethod]}`}>{supplier.paymentMethod.toUpperCase()}</span>}
                            {order.status === OrderStatus.COMPLETED && (
                                isEditingInvoice ? (
                                    <div className="flex items-center space-x-1">
                                        <span className="text-green-300">$</span>
                                        <input type="number" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} onBlur={handleSaveInvoiceAmount} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setIsEditingInvoice(false); }} autoFocus className="bg-gray-900 text-white w-20 p-1 rounded-md text-sm font-mono ring-1 ring-indigo-500" placeholder="0.00" step="0.01" />
                                    </div>
                                ) : (
                                    order.invoiceAmount != null ? (
                                        <button onClick={(e) => { e.stopPropagation(); setIsEditingInvoice(true); }} className="text-sm font-mono bg-gray-700 px-2 py-0.5 rounded-full text-green-300 hover:bg-gray-600">${order.invoiceAmount.toFixed(2)}</button>
                                    ) : (
                                        <button onClick={(e) => { e.stopPropagation(); setIsEditingInvoice(true); }} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700" aria-label="Set Invoice Amount"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.158-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-1.162-.325c-.504 0-.918.336-1.125.683a2.5 2.5 0 00-.229 1.168c0 .635.216 1.183.635 1.572a2.064 2.064 0 001.268.63c.503 0 .91-.223 1.116-.654a2.5 2.5 0 00.217-1.143v-1.7c.221.07.41.164.568.267l.252.165a.5.5 0 00.653-.653l-.62-1.026a.505.505 0 00-.745-.235l-.252.165z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.256A4.535 4.535 0 009 10.592v1.314c-.841.092-1.676.358-2.2324.752-.648.395-1.002 1.05-1.002 1.798 0 .99.602 1.765 1.324 2.256A4.535 4.535 0 009 16.592V17a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 15.766 14 15.009 14 14c0-.99-.602-1.765-1.324-2.256A4.535 4.535 0 0011 11.408V10.094c.841-.092 1.676-.358 2.324-.752.648.395 1.002-1.05 1.002-1.798 0-.99-.602-1.765-1.324-2.256A4.535 4.535 0 0011 4.408V4z" clipRule="evenodd" /></svg></button>
                                    )
                                )
                            )}
                            {showStoreName && <span className="text-gray-400 font-medium text-base">({order.store})</span>}
                        </div>
                    </div>
                </div>
                 <div className="flex-shrink-0 flex items-center space-x-1">
                    <button onClick={() => setIsManuallyCollapsed(!isManuallyCollapsed)} className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-gray-700" aria-label={isManuallyCollapsed ? 'Expand card' : 'Collapse card'}>
                        {isManuallyCollapsed ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>}
                    </button>
                </div>
            </div>

            <div className={`flex flex-col flex-grow overflow-hidden transition-all duration-300 ease-in-out ${isEffectivelyCollapsed ? 'max-h-0 opacity-0' : 'opacity-100'}`}>
                <div className="flex-grow px-2 pt-2 pb-0 space-y-1">
                    {order.items.map(item => {
                        const isEditingPrice = editingPriceItemId === item.itemId;
                        return (
                        <div
                            key={item.itemId}
                            draggable={canEditCard}
                            onDragStart={(e) => handleDragStart(e, item)}
                            onDragEnd={() => setDraggedItem?.(null)}
                            onClick={(e) => handleItemClick(e, item)}
                            onContextMenu={(e) => handleContextMenu(e, item)}
                            role="button" tabIndex={0}
                            className={`flex justify-between items-center px-2 py-1 rounded-md cursor-pointer hover:bg-gray-700 ${canEditCard ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        >
                            <span className={`flex-grow text-gray-300 ${item.isSpoiled ? 'line-through text-gray-500' : ''}`}>
                                {item.isSpoiled && '🔸 '}{item.name}
                                {item.isNew && <span className="ml-2 text-xs font-bold text-yellow-400">NEW</span>}
                            </span>
                            <div className="flex-shrink-0 flex items-center space-x-4">
                                {order.status === OrderStatus.COMPLETED && !isManagerView ? (
                                    isEditingPrice ? (
                                        <input
                                            type="number"
                                            value={editedItemPrice}
                                            onChange={(e) => setEditedItemPrice(e.target.value)}
                                            onBlur={() => handleSaveItemPrice(item)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                if (e.key === 'Escape') setEditingPriceItemId(null);
                                            }}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-gray-900 text-white w-24 p-1 rounded-md text-sm font-mono text-right ring-1 ring-indigo-500"
                                            placeholder="Unit Price"
                                            step="0.01"
                                        />
                                    ) : (
                                        <span className="text-sm font-mono text-gray-400 w-24 text-right">
                                            {item.price != null ? `$${item.price.toFixed(2)}` : ''}
                                        </span>
                                    )
                                ) : null}
                                <span className="font-semibold text-white text-right w-16">{item.quantity}{item.unit}</span>
                            </div>
                        </div>
                    )})}
                </div>
                
                {showActionRow && (
                    <div className="px-2 py-1 mt-1 border-t border-gray-700/50">
                        {order.status === OrderStatus.DISPATCHING && !isManagerView && (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => setAddItemModalOpen(true)} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Add Item"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg></button>
                                    {supplier?.chatId ? <button onClick={handleSendToTelegram} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Send to Telegram"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.51.71l-4.84-3.56-2.22 2.15c-.22.21-.4.33-.7.33z"></path></svg></button> : <button onClick={handleCopyOrderMessage} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Copy Order Text"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3l-4 4-4-4zM15 3v4" /></svg></button>}
                                </div>
                                <button onClick={handleSendOrder} disabled={order.items.length === 0 || isProcessing} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md text-sm disabled:bg-indigo-800 disabled:cursor-not-allowed">{isProcessing ? '...' : 'Send'}</button>
                            </div>
                        )}
                        {order.status === OrderStatus.ON_THE_WAY && (
                            isManagerView ? (
                                <div className="flex items-center justify-between">
                                    <button onClick={handleUnsendOrder} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Unsend"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg></button>
                                    <button onClick={handleMarkAsReceived} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md text-sm disabled:bg-green-800 disabled:cursor-not-allowed">{isProcessing ? '...' : 'Received'}</button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => setAddItemModalOpen(true)} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Add Item"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg></button>
                                        <button onClick={handleUnsendOrder} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Unsend"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg></button>
                                        
                                        {hasNewItems ? <button onClick={handleSendUpdateToTelegram} disabled={isProcessing} className="p-2 bg-yellow-600 hover:bg-yellow-500 rounded-md disabled:bg-yellow-800 disabled:cursor-not-allowed" aria-label="Send Update to Telegram"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.51.71l-4.84-3.56-2.22 2.15c-.22.21-.4.33-.7.33z"></path></svg></button> : supplier?.chatId ? <button onClick={handleSendToTelegram} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Send to Telegram"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.51.71l-4.84-3.56-2.22 2.15c-.22.21-.4.33-.7.33z"></path></svg></button> : <button onClick={handleCopyOrderMessage} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Copy Order Text"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3l-4 4-4-4zM15 3v4" /></svg></button>}
                                    </div>
                                    <button onClick={handleMarkAsReceived} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md text-sm disabled:bg-green-800 disabled:cursor-not-allowed">{isProcessing ? '...' : 'Received'}</button>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
            {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
            {isNumpadOpen && selectedItem && <NumpadModal item={selectedItem} isOpen={isNumpadOpen} onClose={() => setNumpadOpen(false)} onSave={handleSaveItem} onDelete={() => handleDeleteItem(selectedItem)} />}
            {isAddItemModalOpen && <AddItemModal order={order} isOpen={isAddItemModalOpen} onClose={() => setAddItemModalOpen(false)} onAddItem={handleAddItem} />}
            <ConfirmationModal isOpen={isConfirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onConfirm={async () => await actions.deleteOrder(order.id)} title="Drop Order" message={`Are you sure you want to drop the order for ${order.supplierName}?`} confirmText="Drop" isDestructive />
            {selectedMasterItem && isEditItemModalOpen && <EditItemModal item={selectedMasterItem} isOpen={isEditItemModalOpen} onClose={() => setEditItemModalOpen(false)} onSave={handleSaveMasterItem} onDelete={handleDeleteMasterItem} />}
            {supplier && isEditSupplierModalOpen && <EditSupplierModal supplier={supplier} isOpen={isEditSupplierModalOpen} onClose={() => setEditSupplierModalOpen(false)} onSave={handleSaveSupplier} />}
            <AddSupplierModal isOpen={isChangeSupplierModalOpen} onClose={() => setChangeSupplierModalOpen(false)} onSelect={handleChangeSupplier} title="Change Supplier" />
            <MergeOrderModal orderToMerge={order} isOpen={isMergeModalOpen} onClose={() => setIsMergeModalOpen(false)} onMerge={handleMergeOrder} />
            {isPriceNumpadOpen && selectedItem && <PriceNumpadModal item={selectedItem} supplierId={order.supplierId} isOpen={isPriceNumpadOpen} onClose={() => setIsPriceNumpadOpen(false)} onSave={handleSaveUnitPrice} />}
        </div>
    );
};

export default SupplierCard;
