import React, { useContext, useState, useRef, useEffect, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Order, OrderItem, OrderStatus, Unit, Item, Supplier, PaymentMethod, StoreName, ItemPrice, SupplierName } from '../types';
import NumpadModal from './modals/NumpadModal';
import AddItemModal from './modals/AddItemModal';
import ContextMenu from './ContextMenu';
import { useNotifier } from '../context/NotificationContext';
import EditItemModal from './modals/EditItemModal';
import { generateOrderMessage, generateReceiptMessage, renderReceiptTemplate } from '../utils/messageFormatter';
import EditSupplierModal from './modals/EditSupplierModal';
import { sendOrderToSupplierOnTelegram, sendReceiptOnTelegram } from '../services/telegramService';
import AddSupplierModal from './modals/AddSupplierModal';
import MergeOrderModal from './modals/MergeOrderModal';
import PriceNumpadModal from './modals/PriceNumpadModal';
import { generateReceiptTemplateHtml } from '../services/geminiService';
import InvoicePreviewModal from './modals/InvoicePreviewModal';
import PaymentMethodModal from './modals/PaymentMethodModal';

// --- SUB-COMPONENTS START ---

const CardHeader: React.FC<{
  order: Order;
  supplier?: Supplier;
  isManuallyCollapsed: boolean;
  onToggleCollapse: () => void;
  onHeaderContextMenu: (e: React.MouseEvent | React.TouchEvent) => void;
  onHeaderClick: () => void;
  onPaymentBadgeClick: () => void;
  showStoreName?: boolean;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
  showActionsButton?: boolean;
  onActionsClick?: (e: React.MouseEvent) => void;
  orderTotal?: number | null;
  canChangePayment: boolean;
}> = ({ order, supplier, isManuallyCollapsed, onToggleCollapse, onHeaderContextMenu, onHeaderClick, onPaymentBadgeClick, showStoreName, onLongPressStart, onLongPressEnd, showActionsButton, onActionsClick, orderTotal, canChangePayment }) => {
    const paymentMethodBadgeColors: Record<string, string> = {
        [PaymentMethod.ABA]: 'bg-blue-500/50 text-blue-300',
        [PaymentMethod.CASH]: 'bg-green-500/50 text-green-300',
        [PaymentMethod.KALI]: 'bg-purple-500/50 text-purple-300',
        [PaymentMethod.STOCK]: 'bg-gray-500/50 text-gray-300',
    };
    const isManagerView = !!showStoreName;
    const displayPaymentMethod = order.paymentMethod || supplier?.paymentMethod;
    const shouldShowPaymentBadge = displayPaymentMethod && !(isManagerView && (order.store === StoreName.WB || order.store === StoreName.SHANTI));


    return (
        <div
            className="px-2 pt-2 flex justify-between items-start"
            onContextMenu={onHeaderContextMenu}
            onDoubleClick={(e) => e.stopPropagation()}
        >
            <div className="flex-grow">
                <div className="flex items-center gap-2 flex-wrap">
                    {showActionsButton && (
                        <button onClick={onActionsClick} className="p-1 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white" aria-label="Order Actions">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                        </button>
                    )}
                    <h3 
                        onClick={onHeaderClick} 
                        onMouseDown={onLongPressStart}
                        onMouseUp={onLongPressEnd}
                        onMouseLeave={onLongPressEnd}
                        onTouchStart={onLongPressStart}
                        onTouchEnd={onLongPressEnd}
                        className="font-bold text-white text-lg select-none p-1 -m-1 rounded-md transition-all active:ring-2 active:ring-indigo-500 cursor-pointer"
                    >
                        {order.supplierName}
                    </h3>
                    <div className="flex-grow flex items-center gap-2">
                        {shouldShowPaymentBadge && (
                            <button
                                onClick={canChangePayment ? onPaymentBadgeClick : undefined}
                                disabled={!canChangePayment}
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-opacity ${paymentMethodBadgeColors[displayPaymentMethod!]} ${canChangePayment ? 'hover:opacity-80' : 'cursor-default'}`}
                            >
                                {displayPaymentMethod!.toUpperCase()}
                            </button>
                        )}
                         {order.status === OrderStatus.COMPLETED && orderTotal != null && orderTotal > 0 && (
                            <span className="font-mono text-xs text-gray-300 bg-gray-700/50 px-2 py-0.5 rounded-full">
                                ${orderTotal.toFixed(2)}
                            </span>
                        )}
                        {showStoreName && <span className="text-gray-400 font-medium text-base">({order.store})</span>}
                    </div>
                </div>
            </div>
            <div className="flex-shrink-0 flex items-center space-x-1">
                <button onClick={onToggleCollapse} className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-gray-700" aria-label={isManuallyCollapsed ? 'Expand card' : 'Collapse card'}>
                    {isManuallyCollapsed ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>}
                </button>
            </div>
        </div>
    );
};

const OrderItemRow: React.FC<{
  item: OrderItem;
  order: Order;
  isDraggable: boolean;
  dragHandleProps: any;
  onQuantityClick: () => void;
  onContextMenuClick: (e: React.MouseEvent) => void;
  isEditingPrice: boolean;
  editedItemPrice: string;
  onPriceChange: (value: string) => void;
  onPriceSave: () => void;
  onPriceCancel: () => void;
  displayPrice?: number;
  dropZoneProps: any;
  isContextMenuDisabled?: boolean;
}> = ({ item, order, isDraggable, dragHandleProps, onQuantityClick, onContextMenuClick, isEditingPrice, editedItemPrice, onPriceChange, onPriceSave, onPriceCancel, displayPrice, dropZoneProps, isContextMenuDisabled }) => {
    return (
        <div
            {...dropZoneProps}
            className={`flex items-center py-1 rounded-md transition-all duration-150 group ${dropZoneProps.className}`}
        >
            <div
                {...(isDraggable ? dragHandleProps : {})}
                className={`flex-shrink-0 ${isDraggable ? 'cursor-grab active:cursor-grabbing text-gray-500' : 'text-transparent'} ${(order.status === OrderStatus.COMPLETED && !isDraggable) ? 'w-0' : 'pr-1'}`}
            >
                {isDraggable && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                </svg>}
            </div>
            <span className={`flex-grow text-gray-300 ${item.isSpoiled ? 'line-through text-gray-500' : ''}`}>
                {item.name}
            </span>
            <div className="flex-shrink-0 flex items-center space-x-2">
                {isEditingPrice ? (
                     <input
                        type="number"
                        value={editedItemPrice}
                        onChange={(e) => onPriceChange(e.target.value)}
                        onBlur={onPriceSave}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') onPriceCancel();
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="bg-gray-900 text-white w-24 p-1 rounded-md text-sm font-mono text-right ring-1 ring-indigo-500"
                        placeholder="Unit Price"
                        step="0.01"
                    />
                ) : (
                    displayPrice != null && (
                         <span className="text-sm font-mono text-gray-400 w-24 text-right">
                           {`$${displayPrice.toFixed(2)}`}
                         </span>
                    )
                )}
                <div
                    onClick={onQuantityClick}
                    className="font-semibold text-white text-right w-16 p-1 -m-1 rounded-md hover:bg-gray-700 cursor-pointer"
                >
                    {item.quantity}{item.unit}
                </div>
                <button
                    onClick={onContextMenuClick}
                    disabled={isContextMenuDisabled}
                    className="p-1 text-gray-500 rounded-full hover:bg-gray-700 hover:text-white disabled:text-gray-700 disabled:cursor-not-allowed"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

const CardFooter: React.FC<{
  order: Order;
  isManagerView: boolean;
  isOudomManagerWorkflow: boolean;
  isProcessing: boolean;
  canEditCard: boolean;
  onAddItem: () => void;
  onSend: () => void;
  onUnsend: () => void;
  onReceive: () => void;
  onTelegram: () => void;
  onCopy: () => void;
  onAcknowledge?: () => void;
  onCompleteOudom?: () => void;
}> = ({ order, isManagerView, isOudomManagerWorkflow, isProcessing, canEditCard, onAddItem, onSend, onUnsend, onReceive, onTelegram, onCopy, onAcknowledge, onCompleteOudom }) => {
    if (order.status === OrderStatus.COMPLETED) return null;

    if (order.status === OrderStatus.DISPATCHING && !isManagerView && !isOudomManagerWorkflow) {
        return (
            <div className="px-2 py-1 mt-1 border-t border-gray-700/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <button onClick={onAddItem} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Add Item"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg></button>
                        <button onClick={onTelegram} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Send to Telegram"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.51.71l-4.84-3.56-2.22 2.15c-.22.21-.4.33-.7.33z"></path></svg></button>
                        <button onClick={onCopy} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Copy Order Text"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002 2V9a2 2 0 00-2-2h-3l-4 4-4-4zM15 3v4" /></svg></button>
                    </div>
                    <button onClick={onSend} disabled={order.items.length === 0 || isProcessing} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md text-sm disabled:bg-indigo-800 disabled:cursor-not-allowed">{isProcessing ? '...' : 'Send'}</button>
                </div>
            </div>
        );
    }
    
    if (order.status === OrderStatus.ON_THE_WAY) {
        if (isOudomManagerWorkflow) {
            return (
                <div className="px-2 py-1 mt-1 border-t border-gray-700/50">
                    <div className="flex items-center justify-end">
                       {order.supplierName === SupplierName.OUDOM ? (
                           !order.isAcknowledged ? (
                               <button onClick={onAcknowledge} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md text-sm">{isProcessing ? '...' : 'OK'}</button>
                           ) : (
                               <button onClick={onCompleteOudom} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md text-sm">{isProcessing ? '...' : 'DONE'}</button>
                           )
                       ) : ( // For STOCK supplier in OUDOM manager view
                           <button onClick={onReceive} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md text-sm">{isProcessing ? '...' : 'Received'}</button>
                       )}
                    </div>
                </div>
            );
        }

        return (
            <div className="px-2 py-1 mt-1 border-t border-gray-700/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        {canEditCard && <button onClick={onAddItem} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Add Item"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg></button>}
                        <button onClick={onUnsend} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Unsend"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg></button>
                        {!isManagerView && <button onClick={onTelegram} disabled={isProcessing} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:cursor-not-allowed" aria-label="Send to Telegram"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.51.71l-4.84-3.56-2.22 2.15c-.22.21-.4.33-.7.33z"></path></svg></button>}
                    </div>
                    <button onClick={onReceive} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md text-sm disabled:bg-green-800 disabled:cursor-not-allowed">{isProcessing ? '...' : 'Received'}</button>
                </div>
            </div>
        );
    }
    
    return null;
};

// --- SUB-COMPONENTS END ---


interface SupplierCardProps {
  order: Order;
  isManagerView?: boolean;
  isOudomManagerWorkflow?: boolean;
  draggedItem?: { item: OrderItem; sourceOrderId: string } | null;
  setDraggedItem?: (item: { item: OrderItem; sourceOrderId: string } | null) => void;
  onItemDrop?: (destinationOrderId: string) => void;
  showStoreName?: boolean;
  isEditModeEnabled?: boolean;
}

const SupplierCard: React.FC<SupplierCardProps> = ({ order, isManagerView = false, isOudomManagerWorkflow = false, draggedItem, setDraggedItem, onItemDrop, showStoreName = false, isEditModeEnabled = false }) => {
    const { state, dispatch, actions } = useContext(AppContext);
    const { notify } = useNotifier();
    const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
    const [isNumpadOpen, setNumpadOpen] = useState(false);
    const [isAddItemModalOpen, setAddItemModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, options: { label: string; action: () => void; isDestructive?: boolean; }[] } | null>(null);
    const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(() => order.status === OrderStatus.COMPLETED);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isEditingInvoice, setIsEditingInvoice] = useState(false);
    const [invoiceAmount, setInvoiceAmount] = useState<string>('');
    const [isChangeSupplierModalOpen, setChangeSupplierModalOpen] = useState(false);
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [isPriceNumpadOpen, setIsPriceNumpadOpen] = useState(false);
    const [isSpoilMode, setIsSpoilMode] = useState(false);
    
    const [isEditItemModalOpen, setEditItemModalOpen] = useState(false);
    const [selectedMasterItem, setSelectedMasterItem] = useState<Item | null>(null);

    const [isEditSupplierModalOpen, setEditSupplierModalOpen] = useState(false);
    const supplier = state.suppliers.find(s => s.id === order.supplierId);

    const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
    const [editedItemPrice, setEditedItemPrice] = useState<string>('');
    
    const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

    const [invoicePreview, setInvoicePreview] = useState<{ isOpen: boolean; html: string | null, template: string }>({ isOpen: false, html: null, template: '' });
    const [isPaymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
    
    const [isDraggableForMerge, setIsDraggableForMerge] = useState(false);
    const longPressTimer = useRef<number | null>(null);

    const orderTotal = useMemo(() => {
        if (order.status !== OrderStatus.COMPLETED) {
            return null;
        }
        const total = order.items.reduce((acc, item) => {
            if (item.isSpoiled) {
                return acc;
            }
            const masterPrice = state.itemPrices.find(p => p.itemId === item.itemId && p.supplierId === order.supplierId && p.isMaster)?.price;
            const price = item.price ?? masterPrice ?? 0;
            return acc + (price * item.quantity);
        }, 0);
        return total;
    }, [order.status, order.items, order.supplierId, state.itemPrices]);

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
                notify('Invoice amount cleared.', 'info');
            } else {
                const amount = parseFloat(amountStr);
                if (!isNaN(amount) && amount >= 0) {
                    const amountToSave = amount > 1000 ? amount / 4000 : amount;
                    await actions.updateOrder({ ...order, invoiceAmount: amountToSave });
                    notify('Invoice amount saved.', 'success');
                } else {
                    notify('Invalid amount entered.', 'error');
                }
            }
        } finally {
            setIsEditingInvoice(false);
            setIsProcessing(false);
        }
    };
    
    const handleSaveItemPrice = async () => {
        if (!editingPriceItemId) return;
        setIsProcessing(true);
        try {
            const newPrice = parseFloat(editedItemPrice);
            const orderItem = order.items.find(i => i.itemId === editingPriceItemId);
            if (!orderItem) return;

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
                const priceToSave = newPrice > 1000 ? newPrice / 4000 : newPrice;
                updatedItems = order.items.map(i => i.itemId === orderItem.itemId ? { ...i, price: priceToSave } : i );
            }
            
            const newInvoiceAmount = updatedItems.reduce((total, item) => total + ((item.price || 0) * item.quantity), 0);
            
            await actions.updateOrder({ ...order, items: updatedItems, invoiceAmount: newInvoiceAmount });
            notify(`Price updated for ${orderItem.name}.`, 'success');
            
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
          const itemPrice: ItemPrice = { itemId: selectedItem.itemId, supplierId: order.supplierId, price, unit, isMaster };
          await actions.upsertItemPrice(itemPrice);
          notify(`Price for ${selectedItem.name} set to ${price}/${unit}.`, 'success');
        } finally {
          setIsPriceNumpadOpen(false);
          setSelectedItem(null);
          setIsProcessing(false);
        }
    };
    
    const handleQuantityClick = (item: OrderItem) => {
        setSelectedItem(item);
        if (order.status === OrderStatus.COMPLETED && !isManagerView && !isEditModeEnabled) {
            setEditingPriceItemId(item.itemId);
            const masterPrice = state.itemPrices.find(p => p.itemId === item.itemId && p.supplierId === order.supplierId && p.isMaster)?.price;
            const priceForEditing = item.price ?? masterPrice;
            setEditedItemPrice(priceForEditing != null ? String(priceForEditing) : '');
        } else if (order.status !== OrderStatus.COMPLETED || (order.status === OrderStatus.COMPLETED && isEditModeEnabled)) {
            setIsSpoilMode(false); // Default is quantity edit
            setNumpadOpen(true);
        }
    };

    const handleSpoilItemWithQuantity = async (quantity: number) => {
        if (!selectedItem) return;
        const spoilQuantity = isNaN(quantity) ? selectedItem.quantity : quantity;
    
        if (spoilQuantity <= 0 || spoilQuantity > selectedItem.quantity) {
            notify('Invalid spoil quantity.', 'error');
            return;
        }
    
        setIsProcessing(true);
        try {
            const originalItem = selectedItem;
            const remainingQuantity = originalItem.quantity - spoilQuantity;
            const existingSpoiledItemIndex = order.items.findIndex(i => i.itemId === originalItem.itemId && i.isSpoiled);
            let updatedItems = [...order.items];
            const originalItemIndex = updatedItems.findIndex(i => i.itemId === originalItem.itemId && !i.isSpoiled);
            
            if (originalItemIndex !== -1) {
                if (remainingQuantity > 0) {
                    updatedItems[originalItemIndex] = { ...updatedItems[originalItemIndex], quantity: remainingQuantity };
                } else {
                    updatedItems.splice(originalItemIndex, 1);
                }
            }
    
            if (existingSpoiledItemIndex !== -1) {
                updatedItems[existingSpoiledItemIndex].quantity += spoilQuantity;
            } else {
                updatedItems.push({ ...originalItem, quantity: spoilQuantity, isSpoiled: true });
            }
            
            await actions.updateOrder({ ...order, items: updatedItems });
            notify(`${spoilQuantity} ${originalItem.unit || ''} of ${originalItem.name} marked as spoiled.`, 'success');
        } finally {
            setIsProcessing(false);
            setNumpadOpen(false);
            setIsSpoilMode(false);
        }
    };
    
    const handleSaveItem = async (quantity: number, unit?: Unit) => {
        if (!selectedItem) return;
        const masterItem = state.items.find(i => i.id === selectedItem.itemId);
        const isUnitChangedForMaster = masterItem && unit && masterItem.unit !== unit;

        setIsProcessing(true);
        try {
            const newItems = order.items.map(item =>
                (item.itemId === selectedItem.itemId && item.isSpoiled === selectedItem.isSpoiled)
                    ? { ...item, quantity, unit }
                    : item
            );
            await actions.updateOrder({ ...order, items: newItems });

            if (isUnitChangedForMaster) {
                await actions.updateItem({ ...masterItem, unit: unit! });
                notify(`Default unit for "${masterItem.name}" updated to ${unit}.`, 'info');
            }
        } finally {
            setIsProcessing(false);
            setNumpadOpen(false);
            setIsSpoilMode(false);
        }
    };
    
    const handleEditQuantityManager = async (quantity: number) => {
        if (!selectedItem) return;
        const originalQuantity = selectedItem.quantity;
        const difference = originalQuantity - quantity;
    
        if (difference < 0) {
            notify("Cannot increase quantity.", 'error');
            return;
        }
        if (difference === 0) {
            setNumpadOpen(false);
            setIsSpoilMode(false);
            return;
        }
    
        setIsProcessing(true);
        try {
            const currentItems = [...order.items];
            const originalItemIndex = currentItems.findIndex(i => i.itemId === selectedItem.itemId && !i.isSpoiled);
            if (originalItemIndex !== -1) {
                currentItems[originalItemIndex].quantity = quantity;
            }
    
            const existingSpoiledItemIndex = currentItems.findIndex(i => i.itemId === selectedItem.itemId && i.isSpoiled);
            if (existingSpoiledItemIndex !== -1) {
                currentItems[existingSpoiledItemIndex].quantity += difference;
            } else {
                currentItems.push({ ...selectedItem, quantity: difference, isSpoiled: true });
            }
            
            const finalItems = currentItems.filter(i => i.quantity > 0);
    
            await actions.updateOrder({ ...order, items: finalItems });
            notify(`${difference} ${selectedItem.unit || ''} of ${selectedItem.name} marked as spoiled.`, 'success');
        } finally {
            setIsProcessing(false);
            setNumpadOpen(false);
            setIsSpoilMode(false);
        }
    };

    const handleUnspoilItem = async (itemToUnspoil: OrderItem) => {
        if (!itemToUnspoil.isSpoiled) return;
    
        setIsProcessing(true);
        try {
            let updatedItems = [...order.items];
            const spoiledItemIndex = updatedItems.findIndex(i => i.itemId === itemToUnspoil.itemId && i.isSpoiled);
            if (spoiledItemIndex === -1) {
                notify('Could not find spoiled item to unspoil.', 'error');
                return;
            }
            
            const originalItemIndex = updatedItems.findIndex(i => i.itemId === itemToUnspoil.itemId && !i.isSpoiled);
    
            if (originalItemIndex !== -1) {
                updatedItems[originalItemIndex].quantity += itemToUnspoil.quantity;
                updatedItems.splice(spoiledItemIndex, 1);
            } else {
                updatedItems[spoiledItemIndex] = { ...updatedItems[spoiledItemIndex], isSpoiled: false };
            }
    
            await actions.updateOrder({ ...order, items: updatedItems });
            notify(`${itemToUnspoil.name} has been restored.`, 'success');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddItem = async (item: OrderItem) => {
        setIsProcessing(true);
        try {
            const existingItem = order.items.find(i => i.itemId === item.itemId && !i.isSpoiled);
            const newItems = existingItem
                ? order.items.map(i => (i.itemId === item.itemId && !i.isSpoiled) ? { ...i, quantity: i.quantity + item.quantity } : i)
                : [...order.items, item];
            
            await actions.updateOrder({ ...order, items: newItems });
            notify(`Added ${item.name}`, 'success');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteItem = async (item: OrderItem) => {
        setIsProcessing(true);
        try {
            const newItems = order.items.filter(i => !(i.itemId === item.itemId && i.isSpoiled === item.isSpoiled));
            if (newItems.length === 0 && order.status !== OrderStatus.DISPATCHING) {
                await actions.deleteOrder(order.id);
            } else {
                await actions.updateOrder({ ...order, items: newItems });
            }
        } finally {
            setIsProcessing(false);
        }
    }
    
    const handleSendOrder = async () => {
        setIsProcessing(true);
        try {
            await actions.updateOrder({ ...order, status: OrderStatus.ON_THE_WAY, isSent: true });
        } finally { setIsProcessing(false); }
    }

    const handleUnsendOrder = async () => {
        setIsProcessing(true);
        try {
            await actions.updateOrder({ ...order, status: OrderStatus.DISPATCHING, isSent: false });
        } finally { setIsProcessing(false); }
    }

    const handleMarkAsReceived = async () => {
        setIsProcessing(true);
        try {
            await actions.updateOrder({ ...order, status: OrderStatus.COMPLETED, isReceived: true, completedAt: new Date().toISOString() });
        } finally { setIsProcessing(false); }
    }

    const handleAcknowledgeOrder = async () => {
        setIsProcessing(true);
        try {
            await actions.updateOrder({ ...order, isAcknowledged: true });
        } finally { setIsProcessing(false); }
    };
    
    const handleCompleteOudomOrder = async () => {
        setIsProcessing(true);
        try {
            await actions.updateOrder({ ...order, status: OrderStatus.COMPLETED, isReceived: true, completedAt: new Date().toISOString() });
        } finally { setIsProcessing(false); }
    };

    const handleChangeSupplier = async (newSupplier: Supplier) => {
        setIsProcessing(true);
        try {
            await actions.updateOrder({ ...order, supplierId: newSupplier.id, supplierName: newSupplier.name });
            notify(`Order changed to ${newSupplier.name}.`, 'success');
        } finally {
            setIsProcessing(false);
            setChangeSupplierModalOpen(false);
        }
    };
    
    const handleMergeOrder = (destinationOrder: Order) => {
        actions.mergeOrders(order.id, destinationOrder.id);
        setIsMergeModalOpen(false);
    };

    const handleGenerateReceipt = async () => {
        const { geminiApiKey } = state.settings;
        if (!geminiApiKey) {
            notify('Gemini API Key is not set in Settings.', 'error');
            return;
        }
        setIsProcessing(true);
        try {
            let template = state.settings.receiptTemplates?.['default'];
            if (!template) {
                notify('No receipt template found. Generating one with AI...', 'info');
                template = await generateReceiptTemplateHtml(geminiApiKey);
                dispatch({
                    type: 'SAVE_SETTINGS',
                    payload: {
                        receiptTemplates: { ...state.settings.receiptTemplates, 'default': template },
                    },
                });
            }
            
            const renderedHtml = renderReceiptTemplate(template, order, state.itemPrices);
            setInvoicePreview({ isOpen: true, html: renderedHtml, template: template });

        } catch (error: any) {
            notify(`Failed to generate receipt: ${error.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSendTelegramReceipt = async () => {
        const { telegramBotToken } = state.settings;
        if (!supplier || !supplier.chatId || !telegramBotToken) {
            notify('Supplier Chat ID or Bot Token is not configured.', 'error');
            return;
        }
        setIsProcessing(true);
        try {
            const message = generateReceiptMessage(order, state.itemPrices);
            await sendReceiptOnTelegram(order, supplier, message, telegramBotToken);
            notify(`Receipt sent to ${order.supplierName}.`, 'success');
        } catch (error: any) {
            notify(error.message || `Failed to send receipt.`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleHeaderActionsClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        let options: { label: string; action: () => void; isDestructive?: boolean; }[] = [];

        switch (order.status) {
            case OrderStatus.COMPLETED:
                if (!isManagerView) {
                    options.push(
                        { label: 'Receipt', action: handleGenerateReceipt },
                        { label: 'Telegram Receipt', action: handleSendTelegramReceipt }
                    );
                }
                if (isEditModeEnabled) {
                     options.push({ label: 'Change Supplier', action: () => setChangeSupplierModalOpen(true) });
                }
                if (!isManagerView) {
                    options.push({ label: 'Drop', action: () => actions.deleteOrder(order.id), isDestructive: true });
                }
                break;
            case OrderStatus.DISPATCHING:
            case OrderStatus.ON_THE_WAY:
                 if (!isManagerView) {
                    options = [
                        { label: 'Change Supplier', action: () => setChangeSupplierModalOpen(true) },
                        { label: 'Drop', action: () => actions.deleteOrder(order.id), isDestructive: true }
                    ];
                }
                break;
        }

        if (options.length > 0) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setContextMenu({ x: rect.left, y: rect.bottom + 5, options });
        }
    };

    const handleHeaderContextMenu = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        // With the universal actions button, disable right-click on the header for consistency.
        return;
    };

    const handleItemContextMenu = (e: React.MouseEvent, item: OrderItem) => {
        e.preventDefault();
        e.stopPropagation();

        if (isOudomManagerWorkflow) return;

        const options: { label: string; action: () => void; isDestructive?: boolean }[] = [];
        const masterItem = state.items.find(i => i.id === item.itemId);
    
        if (isManagerView && order.status === OrderStatus.ON_THE_WAY) {
            if (item.isSpoiled) {
                options.push({ label: 'Unspoil', action: () => handleUnspoilItem(item) });
            } else {
                options.push({ label: 'Edit Quantity...', action: () => handleQuantityClick(item) });
                options.push({ label: 'Spoil...', action: () => { setSelectedItem(item); setIsSpoilMode(true); setNumpadOpen(true); } });
            }
        } else if (!isManagerView && masterItem) {
            if (order.status !== OrderStatus.COMPLETED) {
                options.push({ label: 'Edit Master Item...', action: () => { setSelectedMasterItem(masterItem); setEditItemModalOpen(true); } });
            }
            if (order.status === OrderStatus.COMPLETED && isEditModeEnabled) {
                options.push({ label: 'Quantity...', action: () => handleQuantityClick(item) });
            }
            options.push({ label: 'Set Unit Price...', action: () => { setSelectedItem(item); setIsPriceNumpadOpen(true); } });
            if (order.status === OrderStatus.ON_THE_WAY) {
                if (item.isSpoiled) {
                    options.push({ label: 'Unspoil', action: () => handleUnspoilItem(item) });
                } else {
                    options.push({ label: 'Spoil...', action: () => { setSelectedItem(item); setIsSpoilMode(true); setNumpadOpen(true); } });
                }
            }
        }

        if (order.status !== OrderStatus.COMPLETED || (order.status === OrderStatus.COMPLETED && isEditModeEnabled)) {
            options.push({ label: 'Drop', action: () => handleDeleteItem(item), isDestructive: true });
        }
    
        if (options.length > 0) {
            setContextMenu({ x: e.clientX, y: e.clientY, options });
        }
    };

    const handleCopyOrderMessage = () => {
        navigator.clipboard.writeText(generateOrderMessage(order, 'plain')).then(() => notify('Order copied!', 'success'));
    };
    
    const handleSendToTelegram = async () => {
        const { telegramBotToken } = state.settings;
        if (!supplier || !supplier.chatId || !telegramBotToken) {
            notify('Supplier Chat ID or Bot Token is not configured.', 'error');
            return;
        }
        setIsProcessing(true);
        try {
            await sendOrderToSupplierOnTelegram(order, supplier, generateOrderMessage(order, 'html'), telegramBotToken);
            notify(`Order sent to ${order.supplierName}.`, 'success');
            if (order.status === OrderStatus.DISPATCHING) {
                await actions.updateOrder({ ...order, status: OrderStatus.ON_THE_WAY, isSent: true });
            }
        } catch (error: any) {
            notify(error.message || `Failed to send.`, 'error');
        } finally { setIsProcessing(false); }
    };
    
    const handleItemDragStart = (e: React.DragEvent, item: OrderItem) => {
        if (setDraggedItem) {
            e.dataTransfer.setData('text/plain', item.itemId);
            e.dataTransfer.effectAllowed = "move";
            setDraggedItem({ item, sourceOrderId: order.id });
        }
    };
    
    const handleMergeDragStart = (e: React.DragEvent) => {
        if (setDraggedItem) setDraggedItem(null); // Critical to differentiate from item drag
        e.dataTransfer.setData('application/x-order-merge', order.id);
        e.dataTransfer.effectAllowed = 'move';
    };
    
    const handleLongPressStart = () => {
        if (order.status === OrderStatus.COMPLETED && !isEditModeEnabled) {
            return;
        }
        longPressTimer.current = window.setTimeout(() => {
            setIsDraggableForMerge(true);
        }, 500);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
    };
    
    const handleMergeDragEnd = () => {
        setIsDraggableForMerge(false);
    };

    const handleInternalReorderDrop = async (e: React.DragEvent, targetItem: OrderItem) => {
        e.preventDefault(); e.stopPropagation();
        if (!draggedItem || draggedItem.sourceOrderId !== order.id || draggedItem.item.itemId === targetItem.itemId) {
            setDragOverItemId(null); return;
        }
        const currentItems = [...order.items];
        const draggedIndex = currentItems.findIndex(i => i.itemId === draggedItem.item.itemId);
        const targetIndex = currentItems.findIndex(i => i.itemId === targetItem.itemId);
        if (draggedIndex === -1 || targetIndex === -1) return;
        const [removedItem] = currentItems.splice(draggedIndex, 1);
        currentItems.splice(targetIndex, 0, removedItem);
        await actions.updateOrder({ ...order, items: currentItems });
        setDragOverItemId(null);
        setDraggedItem?.(null);
    };

    const handlePaymentMethodChange = async (newMethod: PaymentMethod) => {
        setIsProcessing(true);
        try {
            await actions.updateOrder({ ...order, paymentMethod: newMethod });
            notify(`Payment method for ${order.supplierName} set to ${newMethod.toUpperCase()}.`, 'success');
        } finally {
            setIsProcessing(false);
        }
    };

    const isEffectivelyCollapsed = isManuallyCollapsed || (!!draggedItem && draggedItem.sourceOrderId !== order.id);
    const canEditCard = (!isManagerView && (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY)) || (order.status === OrderStatus.COMPLETED && isEditModeEnabled);
    const canChangePayment = canEditCard || (!isManagerView && order.status === OrderStatus.ON_THE_WAY);
    
    return (
        <div
            draggable={isDraggableForMerge}
            onDragStart={handleMergeDragStart}
            onDragEnd={handleMergeDragEnd}
            onDragOver={(e) => {
                e.preventDefault();
                const isItemDrag = !!(draggedItem && draggedItem.sourceOrderId !== order.id);
                const isOrderDrag = e.dataTransfer.types.includes('application/x-order-merge');
                if (isItemDrag || isOrderDrag) {
                    setIsDragOver(true);
                }
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);

                const sourceOrderId = e.dataTransfer.getData('application/x-order-merge');
                if (sourceOrderId && sourceOrderId !== order.id) {
                    const sourceOrder = state.orders.find(o => o.id === sourceOrderId);
                    if (sourceOrder && sourceOrder.store === order.store && sourceOrder.status === order.status) {
                        actions.mergeOrders(sourceOrderId, order.id);
                    } else {
                        notify('Cannot merge these orders.', 'error');
                    }
                } else if (onItemDrop && draggedItem && draggedItem.sourceOrderId !== order.id) {
                    onItemDrop(order.id);
                }
            }}
            className={`relative rounded-xl shadow-lg flex flex-col transition-all duration-300
                ${isDragOver ? 'bg-indigo-900/50' : 'bg-gray-800'}
                ${order.status === OrderStatus.DISPATCHING ? 'border-t-4 border-blue-500' : ''}
                ${order.status === OrderStatus.ON_THE_WAY ? 'border-t-4 border-yellow-500' : ''}
                ${order.status === OrderStatus.COMPLETED ? 'border-t-4 border-green-500' : ''}
            `}
        >
            {isProcessing && <div className="absolute inset-0 bg-gray-900/60 flex items-center justify-center z-10 rounded-xl"><svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>}
            
            <CardHeader
                order={order}
                supplier={supplier}
                isManuallyCollapsed={isEffectivelyCollapsed}
                onToggleCollapse={() => setIsManuallyCollapsed(!isManuallyCollapsed)}
                onHeaderContextMenu={handleHeaderContextMenu}
                onHeaderClick={() => {}}
                onPaymentBadgeClick={() => setPaymentMethodModalOpen(true)}
                showStoreName={showStoreName}
                onLongPressStart={handleLongPressStart}
                onLongPressEnd={handleLongPressEnd}
                showActionsButton={true}
                onActionsClick={handleHeaderActionsClick}
                orderTotal={orderTotal}
                canChangePayment={canChangePayment}
            />

            <div className={`flex flex-col flex-grow overflow-hidden transition-all duration-300 ease-in-out ${isEffectivelyCollapsed ? 'max-h-0 opacity-0' : 'opacity-100'}`}>
                <div className={`flex-grow pt-2 pb-0 space-y-1 ${(order.status === OrderStatus.COMPLETED && !isEditModeEnabled) ? 'px-0' : 'px-2'}`}>
                    {order.items.map(item => {
                         const masterPrice = state.itemPrices.find(p => p.itemId === item.itemId && p.supplierId === order.supplierId && p.isMaster)?.price;
                         const displayPrice = (order.status === OrderStatus.COMPLETED && !isManagerView) ? (item.price ?? masterPrice) : undefined;
                        return (
                            <OrderItemRow
                                key={`${item.itemId}-${item.isSpoiled ? 'spoiled' : 'ok'}`}
                                item={item}
                                order={order}
                                isDraggable={canEditCard}
                                dragHandleProps={{
                                    draggable: true,
                                    onDragStart: (e: React.DragEvent) => handleItemDragStart(e, item),
                                    onDragEnd: () => { setDraggedItem?.(null); setDragOverItemId(null); },
                                }}
                                onQuantityClick={() => handleQuantityClick(item)}
                                onContextMenuClick={(e) => handleItemContextMenu(e, item)}
                                isContextMenuDisabled={isOudomManagerWorkflow}
                                isEditingPrice={editingPriceItemId === item.itemId}
                                editedItemPrice={editedItemPrice}
                                onPriceChange={setEditedItemPrice}
                                onPriceSave={handleSaveItemPrice}
                                onPriceCancel={() => setEditingPriceItemId(null)}
                                displayPrice={displayPrice}
                                dropZoneProps={{
                                    className: dragOverItemId === item.itemId ? 'border-t-2 border-indigo-500' : '',
                                    onDragOver: (e: React.DragEvent) => { if (draggedItem && draggedItem.sourceOrderId === order.id) e.preventDefault(); },
                                    onDragEnter: () => { if (draggedItem && draggedItem.sourceOrderId === order.id && draggedItem.item.itemId !== item.itemId) setDragOverItemId(item.itemId); },
                                    onDragLeave: () => setDragOverItemId(null),
                                    onDrop: (e: React.DragEvent) => handleInternalReorderDrop(e, item),
                                }}
                            />
                        )
                    })}
                </div>
                
                <CardFooter
                    order={order}
                    isManagerView={isManagerView}
                    isOudomManagerWorkflow={isOudomManagerWorkflow}
                    isProcessing={isProcessing}
                    canEditCard={canEditCard}
                    onAddItem={() => setAddItemModalOpen(true)}
                    onSend={handleSendOrder}
                    onUnsend={handleUnsendOrder}
                    onReceive={handleMarkAsReceived}
                    onTelegram={handleSendToTelegram}
                    onCopy={handleCopyOrderMessage}
                    onAcknowledge={handleAcknowledgeOrder}
                    onCompleteOudom={handleCompleteOudomOrder}
                />
            </div>
            {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
            {isNumpadOpen && selectedItem && (
              <NumpadModal 
                  item={selectedItem} 
                  isOpen={isNumpadOpen} 
                  onClose={() => { setNumpadOpen(false); setIsSpoilMode(false); }} 
                  onSave={ isManagerView ? handleEditQuantityManager : isSpoilMode ? handleSpoilItemWithQuantity : handleSaveItem }
                  onDelete={() => handleDeleteItem(selectedItem)} 
              />
            )}
            {isAddItemModalOpen && <AddItemModal order={order} isOpen={isAddItemModalOpen} onClose={() => setAddItemModalOpen(false)} onAddItem={handleAddItem} />}
            {selectedMasterItem && isEditItemModalOpen && <EditItemModal item={selectedMasterItem} isOpen={isEditItemModalOpen} onClose={() => setEditItemModalOpen(false)} onSave={async (item) => actions.updateItem(item as Item)} onDelete={actions.deleteItem} />}
            {supplier && isEditSupplierModalOpen && <EditSupplierModal supplier={supplier} isOpen={isEditSupplierModalOpen} onClose={() => setEditSupplierModalOpen(false)} onSave={actions.updateSupplier} />}
            <AddSupplierModal isOpen={isChangeSupplierModalOpen} onClose={() => setChangeSupplierModalOpen(false)} onSelect={handleChangeSupplier} title="Change Supplier" />
            <MergeOrderModal orderToMerge={order} isOpen={isMergeModalOpen} onClose={() => setIsMergeModalOpen(false)} onMerge={handleMergeOrder} />
            {isPriceNumpadOpen && selectedItem && <PriceNumpadModal item={selectedItem} supplierId={order.supplierId} isOpen={isPriceNumpadOpen} onClose={() => setIsPriceNumpadOpen(false)} onSave={handleSaveUnitPrice} />}
            <InvoicePreviewModal isOpen={invoicePreview.isOpen} onClose={() => setInvoicePreview({ isOpen: false, html: null, template: '' })} receiptHtml={invoicePreview.html} receiptTemplate={invoicePreview.template} />
            <PaymentMethodModal isOpen={isPaymentMethodModalOpen} onClose={() => setPaymentMethodModalOpen(false)} onSelect={handlePaymentMethodChange} order={order} />
        </div>
    );
};

export default SupplierCard;