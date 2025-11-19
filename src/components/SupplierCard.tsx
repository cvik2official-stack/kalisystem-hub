import React, { useContext, useState, useMemo, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { Order, OrderStatus, PaymentMethod, Supplier, OrderItem, Unit, Item, ItemPrice, SupplierName } from '../types';
import ContextMenu from './ContextMenu';
import AddSupplierModal from './modals/AddSupplierModal';
import PaymentMethodModal from './modals/PaymentMethodModal';
import NumpadModal from './modals/NumpadModal';
import EditItemModal from './modals/EditItemModal';
import PriceNumpadModal from './modals/PriceNumpadModal';
import AddItemModal from './modals/AddItemModal';
import { generateOrderMessage } from '../utils/messageFormatter';
import { sendOrderToSupplierOnTelegram } from '../services/telegramService';
import { useNotifier } from '../context/NotificationContext';
import { getLatestItemPrice } from '../utils/messageFormatter';

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
    const longPressTimer = useRef<number | null>(null);
    const isLongPress = useRef(false);
    const [activeItemId, setActiveItemId] = useState<string | null>(null);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);


    // State for item modals
    const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
    const [isNumpadOpen, setNumpadOpen] = useState(false);
    const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
    const [selectedMasterItem, setSelectedMasterItem] = useState<Item | null>(null);
    const [isPriceNumpadOpen, setIsPriceNumpadOpen] = useState(false);
    const [editingPriceUniqueId, setEditingPriceUniqueId] = useState<string | null>(null);
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);

    const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            if (!isManuallyCollapsed && (order.status === OrderStatus.ON_THE_WAY || order.status === OrderStatus.COMPLETED)) {
                 setIsManuallyCollapsed(true);
            }
            setActiveItemId(null);
            setEditingItemId(null);
            setEditingPriceUniqueId(null);
        }
    };

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
            const sourceOrder = state.orders.find(o => o.id === state.draggedOrderId);
            if (sourceOrder) {
                canDrop = true;
            }
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
        if (order.status === OrderStatus.DISPATCHING) return 0;
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

    const handleItemActionsClick = (e: React.MouseEvent, item: OrderItem) => {
        e.stopPropagation();
        const masterItem = state.items.find(i => i.id === item.itemId);
        if (!masterItem) return;

        const options = [
            { label: 'Edit Master', action: () => { setSelectedMasterItem(masterItem); setIsEditItemModalOpen(true); } },
            { label: 'Set Price', action: () => { setSelectedItem(item); setIsPriceNumpadOpen(true); } },
            { label: 'Drop', action: () => handleDeleteItem(item), isDestructive: true },
        ];

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setContextMenu({ x: rect.left, y: rect.bottom + 5, options });
    };

    const handleQuantityOrPriceClick = (item: OrderItem) => {
        if (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY || order.status === OrderStatus.COMPLETED) {
            setSelectedItem(item);
            setNumpadOpen(true);
        }
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
          const { price, ...itemWithoutPrice } = itemToUpdate;
          if (itemToUpdate.price !== undefined) {
               await actions.updateOrder({ ...order, items: order.items.map(i => i.itemId === itemToUpdate.itemId ? itemWithoutPrice : i) });
          }
          return;
      }
  
      if (itemToUpdate.quantity === 0) {
          notify('Cannot set price for item with quantity 0.', 'error');
          return;
      }
      
      if (newTotalPrice !== null && !isNaN(newTotalPrice) && newTotalPrice >= 0) {
          const newUnitPrice = newTotalPrice / itemToUpdate.quantity;
          const updatedItems = order.items.map(i =>
              (i.itemId === itemToUpdate.itemId && i.isSpoiled === itemToUpdate.isSpoiled)
                  ? { ...i, price: newUnitPrice }
                  : i
          );
          await actions.updateOrder({ ...order, items: updatedItems });
      } else {
          notify('Invalid price.', 'error');
      }
  };

    const handleItemNameClick = (uniqueItemId: string) => {
        if (activeItemId === uniqueItemId) {
            setEditingItemId(uniqueItemId);
        } else {
            setActiveItemId(uniqueItemId);
            setEditingItemId(null);
        }
    };
    
    const handleItemNameSave = async (itemToUpdate: OrderItem, newName: string) => {
        const trimmedName = newName.trim();
        if (itemToUpdate.name === trimmedName || trimmedName === '') {
            setEditingItemId(null);
            return;
        }
    
        const updatedItems = order.items.map(i =>
            (i.itemId === itemToUpdate.itemId && i.isSpoiled === itemToUpdate.isSpoiled)
                ? { ...i, name: trimmedName }
                : i
        );
        
        await actions.updateOrder({ ...order, items: updatedItems });
    
        setEditingItemId(null);
    };

    const handleSaveItemQuantity = async (quantity: number, unit?: Unit) => {
        if (!selectedItem) return;
        setIsProcessing(true);
        try {
            const newItems = order.items.map(i =>
                (i.itemId === selectedItem.itemId && i.isSpoiled === selectedItem.isSpoiled)
                    ? { ...i, quantity, unit: unit || i.unit }
                    : i
            );
            await actions.updateOrder({ ...order, items: newItems });
        } finally {
            setIsProcessing(false);
            setNumpadOpen(false);
        }
    };

    const handleDeleteItem = async (itemToDelete: OrderItem) => {
        setIsProcessing(true);
        try {
            const newItems = order.items.filter(i => !(i.itemId === itemToDelete.itemId && i.isSpoiled === itemToDelete.isSpoiled));
            await actions.updateOrder({ ...order, items: newItems });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleAddItemFromModal = async (item: Item) => {
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
    };

    const handleSaveUnitPrice = async (price: number, unit: Unit) => {
        if (!selectedItem) return;
        setIsProcessing(true);
        try {
          const itemPrice: Omit<ItemPrice, 'id' | 'createdAt'> = { itemId: selectedItem.itemId, supplierId: order.supplierId, price, unit };
          await actions.upsertItemPrice(itemPrice);
        } finally {
          setIsPriceNumpadOpen(false);
          setSelectedItem(null);
          setIsProcessing(false);
        }
    };

    const handleSendToTelegram = async () => {
        const { settings, suppliers, stores } = state;
        const currentSupplier = suppliers.find(s => s.id === order.supplierId);
        if (!currentSupplier || !currentSupplier.chatId || !settings.telegramBotToken) {
            notify('Supplier Chat ID or Bot Token is not configured.', 'error');
            return;
        }
        setIsProcessing(true);
        try {
            await sendOrderToSupplierOnTelegram(order, currentSupplier, generateOrderMessage(order, 'html', suppliers, stores, settings), settings.telegramBotToken);
            notify(`Order sent to ${order.supplierName}.`, 'success');
            await actions.updateOrder({ ...order, isSent: true, status: OrderStatus.ON_THE_WAY });
        } catch (error: any) {
            notify(error.message || `Failed to send.`, 'error');
        } finally { setIsProcessing(false); }
    };
    
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
    
    const handleTelegramPressStart = () => {
        isLongPress.current = false;
        longPressTimer.current = window.setTimeout(() => {
            isLongPress.current = true;
            handleLongPressAction();
        }, 500);
    };

    const handleTelegramPressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleTelegramClick = () => {
        if (!isLongPress.current) {
            handleSendToTelegram();
        }
    };

    const handleToggleToPriceNumpad = () => {
        setNumpadOpen(false);
        setIsPriceNumpadOpen(true);
    };
    
    const handleToggleToQuantityNumpad = () => {
        setIsPriceNumpadOpen(false);
        setNumpadOpen(true);
    };

    const paymentMethodBadgeColors: Record<string, string> = {
        [PaymentMethod.ABA]: 'bg-blue-500/50 text-blue-300',
        [PaymentMethod.CASH]: 'bg-green-500/50 text-green-300',
        [PaymentMethod.KALI]: 'bg-purple-500/50 text-purple-300',
        [PaymentMethod.STOCK]: 'bg-gray-500/50 text-gray-300',
        [PaymentMethod.MISHA]: 'bg-orange-500/50 text-orange-300',
    };

    const paymentMethodAmountBadgeColors: Record<string, string> = {
        [PaymentMethod.ABA]: 'bg-blue-600/50 text-blue-200',
        [PaymentMethod.CASH]: 'bg-green-600/50 text-green-200',
        [PaymentMethod.KALI]: 'bg-purple-600/50 text-purple-200',
        [PaymentMethod.STOCK]: 'bg-gray-600/50 text-gray-200',
        [PaymentMethod.MISHA]: 'bg-orange-600/50 text-orange-200',
    };

    const displayPaymentMethod = order.paymentMethod || supplier?.paymentMethod;
    let badgeColorClass = paymentMethodBadgeColors[displayPaymentMethod] || 'bg-gray-600';
    let amountBadgeColorClass = paymentMethodAmountBadgeColors[displayPaymentMethod] || 'bg-gray-700';
    if (displayPaymentMethod === PaymentMethod.STOCK && supplier?.paymentMethod && supplier.paymentMethod !== PaymentMethod.STOCK) {
        badgeColorClass = paymentMethodBadgeColors[supplier.paymentMethod] || 'bg-gray-600';
        amountBadgeColorClass = paymentMethodAmountBadgeColors[supplier.paymentMethod] || 'bg-gray-700';
    }


    const statusBorderColor = useMemo(() => {
        switch (order.status) {
            case OrderStatus.DISPATCHING: return 'border-blue-500';
            case OrderStatus.ON_THE_WAY: return 'border-yellow-500';
            case OrderStatus.COMPLETED: return 'border-green-700';
            default: return 'border-gray-500';
        }
    }, [order.status]);
    
    const isKaliOrder = supplier?.name === SupplierName.KALI || displayPaymentMethod === PaymentMethod.KALI;

    const isEffectivelyCollapsed = (state.draggedItem && state.draggedItem.sourceOrderId !== order.id) ? true : isManuallyCollapsed;

    return (
        <>
            <div 
                ref={cardRef}
                tabIndex={-1}
                onBlur={handleBlur}
                onDragOver={handleCardDragOver}
                onDragLeave={handleCardDragLeave}
                onDrop={handleCardDrop}
                className={`outline-none relative rounded-xl shadow-lg flex flex-col transition-all duration-300 ${isDragOver ? 'bg-indigo-900/50' : 'bg-gray-800'} border-t-2 ${statusBorderColor} w-full max-w-sm`}
            >
                {isProcessing && <div className="absolute inset-0 bg-gray-900/60 flex items-center justify-center z-10 rounded-xl"><svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>}
                
                <div 
                    className="px-1 py-2 flex justify-between items-center cursor-grab active:cursor-grabbing"
                    draggable="true"
                    onDragStart={handleCardDragStart}
                    onDragEnd={handleCardDragEnd}
                    onClick={() => setIsManuallyCollapsed(!isManuallyCollapsed)}
                >
                    <div className="flex items-center gap-2 flex-grow min-w-0">
                        {!isEffectivelyCollapsed && (
                            <button onClick={(e) => { e.stopPropagation(); handleHeaderActionsClick(e); }} className="p-1 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white" aria-label="Order Actions">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                            </button>
                        )}
                        <h3 
                            className="font-bold text-white text-xs select-none truncate"
                        >
                            {showStoreName && <span className="font-semibold text-gray-500 mr-2">{order.store}</span>}
                            {order.supplierName}
                        </h3>
                        {displayPaymentMethod && (
                            <div className="flex items-stretch overflow-hidden rounded-full flex-shrink-0">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setPaymentMethodModalOpen(true); }}
                                    className={`px-2 py-0.5 text-xs font-semibold cursor-pointer ${badgeColorClass}`}
                                >
                                    {displayPaymentMethod.toUpperCase()}
                                </button>
                                {(order.status === OrderStatus.ON_THE_WAY || order.status === OrderStatus.COMPLETED) && cardTotal > 0 && (
                                    <span className={`px-2 py-0.5 text-xs font-semibold ${amountBadgeColorClass}`}>
                                        {cardTotal.toFixed(2)}
                                    </span>
                                )}
                            </div>
                        )}
                        {order.status === OrderStatus.DISPATCHING && (
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleTelegramClick(); }}
                                    onMouseDown={(e) => { e.stopPropagation(); handleTelegramPressStart(); }}
                                    onMouseUp={(e) => { e.stopPropagation(); handleTelegramPressEnd(); }}
                                    onMouseLeave={(e) => { e.stopPropagation(); handleTelegramPressEnd(); }}
                                    onTouchStart={(e) => { e.stopPropagation(); handleTelegramPressStart(); }}
                                    onTouchEnd={(e) => { e.stopPropagation(); handleTelegramPressEnd(); }}
                                    disabled={!supplier?.chatId || isProcessing}
                                    className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors duration-200 ${(order.isSent || !supplier?.chatId) ? 'bg-gray-600' : 'bg-blue-500'}`}
                                    aria-label="Send to Telegram"
                                    title="Click: Send & Move | Long-press: Move & Copy"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.51.71l-4.84-3.56-2.22 2.15c-.22.21-.4.33-.7.33z"></path></svg>
                                </button>
                            </div>
                        )}
                        {order.status === OrderStatus.ON_THE_WAY && supplier?.contact && (
                            <a
                                href={`https://t.me/${supplier.contact.replace('@', '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-600 hover:bg-gray-500 transition-colors"
                                title="Open Telegram Chat"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.51.71l-4.84-3.56-2.22 2.15c-.22.21-.4.33-.7.33z"></path></svg>
                            </a>
                        )}
                    </div>
                    <div className="flex-shrink-0 flex items-center">
                         <div className="text-gray-500 p-1">
                            {isEffectivelyCollapsed ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>}
                        </div>
                    </div>
                </div>

                <div className={`flex-grow overflow-hidden transition-all duration-300 ease-in-out ${isEffectivelyCollapsed ? 'max-h-0 opacity-0' : 'opacity-100'}`} onTransitionEnd={() => { if (isEffectivelyCollapsed) { setEditingItemId(null); } }}>
                    <div className="pt-1 pb-1 px-1">
                        <ul className="space-y-1">
                        {order.items.length === 0 ? (
                            <li className="text-center text-gray-500 text-sm py-4 px-2">
                                No items.
                            </li>
                        ) : order.items.map(item => {
                            const uniqueItemId = `${item.itemId}-${item.isSpoiled ? 'spoiled' : 'clean'}`;
                            const isActive = activeItemId === uniqueItemId;
                            const isEditing = editingItemId === uniqueItemId;
                            const latestPriceInfo = getLatestItemPrice(item.itemId, order.supplierId, state.itemPrices);
                            const unitPrice = item.price ?? latestPriceInfo?.price ?? null;
                            const isEditingPrice = editingPriceUniqueId === uniqueItemId;
                            const isStockMovement = order.supplierName === SupplierName.STOCK || order.paymentMethod === PaymentMethod.STOCK;

                            return (
                                <li key={uniqueItemId} className="flex items-center group">
                                    <div
                                        draggable={isActive}
                                        onDragStart={(e) => handleItemDragStart(e, item)}
                                        onDragEnd={handleItemDragEnd}
                                        className={`transition-all duration-200 flex items-center ${isActive ? 'opacity-100 w-5 mr-1 cursor-grab active:cursor-grabbing text-gray-500' : 'opacity-0 w-0'}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                defaultValue={item.name}
                                                autoFocus
                                                onBlur={(e) => handleItemNameSave(item, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') e.currentTarget.blur();
                                                    if (e.key === 'Escape') setEditingItemId(null);
                                                }}
                                                className="bg-gray-700 text-gray-200 rounded px-1 py-0.5 w-full outline-none"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span onClick={() => handleItemNameClick(uniqueItemId)} className="text-gray-300 truncate cursor-pointer block">
                                                {item.name}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2 ml-2">
                                        <div onClick={() => handleQuantityOrPriceClick(item)} className={`text-white text-right w-16 p-1 -m-1 rounded-md ${(order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY || order.status === OrderStatus.COMPLETED) ? 'hover:bg-gray-700 cursor-pointer' : 'cursor-default'}`}>
                                            {isStockMovement && order.supplierName === SupplierName.STOCK && <span className="font-semibold text-yellow-400 mr-1">out</span>}
                                            {isStockMovement && order.paymentMethod === PaymentMethod.STOCK && <span className="font-semibold text-green-400 mr-1">in</span>}
                                            {item.quantity}{item.unit}
                                        </div>
                                        {isEditingPrice ? (
                                            <input
                                                type="text" inputMode="decimal"
                                                defaultValue={unitPrice !== null ? (unitPrice * item.quantity).toFixed(2) : ''}
                                                autoFocus={isEditingPrice}
                                                onFocus={() => setEditingPriceUniqueId(uniqueItemId)}
                                                onBlur={(e) => handleSaveInlinePrice(item, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') e.currentTarget.blur();
                                                    if (e.key === 'Escape') setEditingPriceUniqueId(null);
                                                }}
                                                className={`bg-gray-700 font-mono rounded px-1 py-0.5 w-20 text-right ${isKaliOrder ? 'text-purple-300' : 'text-cyan-300'} outline-none`}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <div 
                                                onClick={() => setEditingPriceUniqueId(uniqueItemId)} 
                                                className={`font-mono w-20 text-right p-1 -m-1 rounded-md hover:bg-gray-700 cursor-pointer ${isKaliOrder ? 'text-purple-300' : 'text-cyan-300'}`}
                                            >
                                                {unitPrice !== null ? (unitPrice * item.quantity).toFixed(2) : <span className="text-gray-500">-</span>}
                                            </div>
                                        )}
                                        <button 
                                            onClick={(e) => handleItemActionsClick(e, item)}
                                            className={`p-1 text-gray-500 rounded-full hover:bg-gray-700 hover:text-white transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                        </button>
                                    </div>
                                </li>
                            )
                        })}
                        {(order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY) && !isEffectivelyCollapsed && (
                            <li className="px-1 pt-2">
                                <button 
                                    onClick={() => setIsAddItemModalOpen(true)} 
                                    className="text-left text-gray-500 hover:text-white hover:bg-gray-700/50 text-sm p-2 rounded-md w-full transition-colors"
                                >
                                    + Add item
                                </button>
                            </li>
                        )}
                        </ul>
                    </div>
                </div>
            </div>

            {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
            <AddSupplierModal isOpen={isChangeSupplierModalOpen} onClose={() => setChangeSupplierModalOpen(false)} onSelect={handleChangeSupplier} title="Change Supplier" />
            <PaymentMethodModal isOpen={isPaymentMethodModalOpen} onClose={() => setPaymentMethodModalOpen(false)} onSelect={handlePaymentMethodChange} order={order} />
            {isNumpadOpen && selectedItem && <NumpadModal item={selectedItem} isOpen={isNumpadOpen} onClose={() => setNumpadOpen(false)} onSave={handleSaveItemQuantity} onDelete={() => handleDeleteItem(selectedItem)} onToggle={handleToggleToPriceNumpad} />}
            {selectedMasterItem && isEditItemModalOpen && <EditItemModal item={selectedMasterItem} isOpen={isEditItemModalOpen} onClose={() => setIsEditItemModalOpen(false)} onSave={async (item) => actions.updateItem(item as Item)} onDelete={actions.deleteItem} />}
            {isPriceNumpadOpen && selectedItem && <PriceNumpadModal item={selectedItem} supplierId={order.supplierId} isOpen={isPriceNumpadOpen} onClose={() => setIsPriceNumpadOpen(false)} onSave={handleSaveUnitPrice} onToggle={handleToggleToQuantityNumpad} />}
            <AddItemModal isOpen={isAddItemModalOpen} onClose={() => setIsAddItemModalOpen(false)} onItemSelect={handleAddItemFromModal} order={order} />
        </>
    );
};

export default SupplierCard;