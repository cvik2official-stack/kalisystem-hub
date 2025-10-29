import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { Order, OrderItem, OrderStatus, Unit } from '../types';
import NumpadModal from './modals/NumpadModal';
import AddItemModal from './modals/AddItemModal';
import OrderMessageModal from './modals/OrderMessageModal';
import ContextMenu from './ContextMenu';
import { useToasts } from '../context/ToastContext';

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
    const [isMessageModalOpen, setMessageModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, options: { label: string; action: () => void; isDestructive?: boolean; }[] } | null>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);
    const clickTimer = useRef<number | null>(null);

    const handleSingleClick = (item: OrderItem) => {
        if (isManagerView) return;
        if (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY) {
          setSelectedItem(item);
          setNumpadOpen(true);
        }
    };

    const handleItemClick = (e: React.MouseEvent, item: OrderItem) => {
        if (clickTimer.current === null) {
            clickTimer.current = window.setTimeout(() => {
                clickTimer.current = null;
                handleSingleClick(item);
            }, 250);
        } else {
            window.clearTimeout(clickTimer.current);
            clickTimer.current = null;
            handleItemContextMenu(e, item);
        }
    };


    const handleSaveItem = (quantity: number, unit?: Unit) => {
        if (selectedItem) {
            dispatch({ type: 'UPDATE_ORDER_ITEM', payload: { orderId: order.id, itemId: selectedItem.itemId, quantity, unit }});
        }
        setNumpadOpen(false);
        setSelectedItem(null);
    };

    const handleAddItem = (item: OrderItem) => {
        dispatch({ type: 'ADD_ITEM_TO_ORDER', payload: { orderId: order.id, item } });
        addToast(`Added ${item.name}`, 'success');
    };

    const handleDeleteItem = async (item: OrderItem) => {
        const masterItem = state.items.find(i => i.id === item.itemId);
        // Only items that truly exist in the DB can be deleted.
        if (masterItem) {
            try {
                // First, try to delete from the database.
                await actions.deleteItem(masterItem.id);
                // If successful, then remove from the local order.
                dispatch({ type: 'DELETE_ORDER_ITEM', payload: { orderId: order.id, itemId: item.itemId } });
            } catch(e) {
                // Error toast is handled in the context.
            }
        } else {
            // If it's just a "new" unsaved item, just remove it locally.
            dispatch({ type: 'DELETE_ORDER_ITEM', payload: { orderId: order.id, itemId: item.itemId } });
        }
        setContextMenu(null);
    }
    
    const handleSendOrder = () => {
        dispatch({ type: 'UPDATE_ORDER', payload: { ...order, status: OrderStatus.ON_THE_WAY, isSent: true } });
    }

    const handleUnsendOrder = () => {
        dispatch({ type: 'UPDATE_ORDER', payload: { ...order, status: OrderStatus.DISPATCHING, isSent: false } });
    }

    const handleMarkAsReceived = () => {
        dispatch({ type: 'UPDATE_ORDER', payload: { ...order, status: OrderStatus.COMPLETED, isReceived: true } });
    }

    const handleSpoilItem = (item: OrderItem) => {
        dispatch({ type: 'SPOIL_ITEM', payload: { orderId: order.id, item, store: order.store } });
        addToast(`${item.name} marked as spoiled. Re-order created.`, 'info');
        setContextMenu(null);
    }

    const handleItemContextMenu = (e: React.MouseEvent | React.TouchEvent, item: OrderItem) => {
        e.preventDefault();
        const options: { label: string; action: () => void; isDestructive?: boolean; }[] = [];
        if (isManagerView && order.status === OrderStatus.ON_THE_WAY && !item.isSpoiled) {
             options.push({ label: 'Mark as Spoiled', action: () => handleSpoilItem(item) });
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
        if (window.confirm(`Are you sure you want to delete the order for ${order.supplierName}? This action cannot be undone.`)) {
            dispatch({ type: 'DELETE_ORDER', payload: order.id });
        }
    }

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
                const masterItem = state.items.find(i => i.id === item.itemId);
                
                if (masterItem && masterItem.supplierId !== order.supplierId) {
                    // This item's supplier is changing, so we must persist it.
                    await actions.updateItem({ ...masterItem, supplierId: order.supplierId, supplierName: order.supplierName });
                }
                
                // This dispatch is still local as it only affects the orders state.
                dispatch({ 
                    type: 'MOVE_ITEM_BETWEEN_ORDERS', 
                    payload: { sourceOrderId, destOrderId: order.id, item } 
                });
                addToast(`Moved ${item.name} to ${order.supplierName}`, 'success');
            }
        } catch (error) {
            console.error("Drop failed:", error);
            // Error toast is handled by the action.
        }
    };
    
    const isEffectivelyCollapsed = isCollapsedByDrag || isManuallyCollapsed;
    const canEditCard = !isManagerView && (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY);
    const canDragItems = !isManagerView && order.status === OrderStatus.DISPATCHING;
    const isItemInteractive = canEditCard || isManagerView;
    const showActionRow = order.status !== OrderStatus.DISPATCHING || order.items.length > 0;

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`bg-gray-800 rounded-xl shadow-lg flex flex-col border-t-4 transition-all duration-300
                ${order.status === OrderStatus.DISPATCHING ? 'border-blue-500' : ''}
                ${order.status === OrderStatus.ON_THE_WAY ? 'border-yellow-500' : ''}
                ${order.status === OrderStatus.COMPLETED ? 'border-green-500' : ''}
                ${isDraggingOver ? 'ring-2 ring-indigo-500' : ''}
            `}
        >
            <div className="p-3 flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-white text-lg">{order.supplierName}</h3>
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
                    {!isManagerView && order.status === OrderStatus.DISPATCHING &&
                        <button onClick={handleDeleteOrder} className="text-gray-500 hover:text-red-500 p-1 rounded-full hover:bg-gray-700" aria-label="Delete Order">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                    }
                </div>
            </div>

            <div className={`flex flex-col flex-grow overflow-hidden transition-all duration-300 ease-in-out ${isEffectivelyCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}>
                <div className={`flex-grow px-3 pt-0 pb-0 space-y-2 overflow-y-auto ${order.items.length > 0 ? 'min-h-[120px]' : 'min-h-[60px]'}`}>
                    {order.items.length > 0 &&
                        order.items.map(item => (
                            <div
                                key={item.itemId}
                                onClick={(e) => handleItemClick(e, item)}
                                onContextMenu={(e) => handleItemContextMenu(e, item)}
                                role="button"
                                tabIndex={isItemInteractive ? 0 : -1}
                                draggable={canDragItems}
                                onDragStart={(e) => canDragItems && handleDragStart(e, item)}
                                onDragEnd={() => canDragItems && handleDragEnd()}
                                className={`flex justify-between items-center p-2 rounded-md 
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
                    {canEditCard && (
                        <button 
                            onClick={() => setAddItemModalOpen(true)}
                            className="w-full text-center p-2 mt-2 text-indigo-400 hover:text-indigo-300 font-medium text-sm"
                        >
                            + Add Item
                        </button>
                    )}
                </div>
                
                <div className="px-3 py-2 bg-gray-800/50 rounded-b-xl border-t border-gray-700/50 flex flex-col space-y-2">
                  {!isManagerView && showActionRow && (
                    <div className="flex items-center space-x-2">
                       {order.status === OrderStatus.DISPATCHING && (
                         <>
                           <button onClick={handleSendOrder} disabled={order.items.length === 0} className="flex-grow bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md text-sm disabled:bg-indigo-800 disabled:cursor-not-allowed">
                             Send
                           </button>
                            <button onClick={() => setMessageModalOpen(true)} disabled={order.items.length === 0} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Order Message">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 2.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                              </svg>
                           </button>
                         </>
                       )}
                       {order.status === OrderStatus.ON_THE_WAY && (
                         <>
                            <button onClick={handleUnsendOrder} className="p-2 bg-gray-600 hover:bg-gray-500 rounded-md" aria-label="Unsend">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                </svg>
                            </button>
                            <div className="flex-grow"></div>
                            <button onClick={() => setMessageModalOpen(true)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md" aria-label="Order Message">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 2.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                </svg>
                            </button>
                            <button onClick={handleMarkAsReceived} className="p-2 bg-green-600 hover:bg-green-700 rounded-md" aria-label="Mark as Received">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </button>
                         </>
                       )}
                    </div>
                  )}
                   {order.status === OrderStatus.COMPLETED && <div className="text-center text-green-400 text-sm font-semibold">Order completed.</div>}
                </div>
            </div>

            {selectedItem && <NumpadModal item={selectedItem} isOpen={isNumpadOpen} onClose={() => setNumpadOpen(false)} onSave={handleSaveItem} />}
            <AddItemModal order={order} isOpen={isAddItemModalOpen} onClose={() => setAddItemModalOpen(false)} onAddItem={handleAddItem} />
            <OrderMessageModal order={order} isOpen={isMessageModalOpen} onClose={() => setMessageModalOpen(false)} />
            {contextMenu && <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={() => setContextMenu(null)}
                options={contextMenu.options}
            />}
        </div>
    );
};

export default SupplierCard;