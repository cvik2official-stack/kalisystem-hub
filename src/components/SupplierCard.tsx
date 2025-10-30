import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { Order, OrderItem, OrderStatus, Unit } from '../types';
import AddItemModal from './modals/AddItemModal';
import NumpadModal from './modals/NumpadModal';
import ContextMenu from './ContextMenu';
import { useToasts } from '../context/ToastContext';
import OrderMessageModal from './modals/OrderMessageModal';
import ConfirmationModal from './modals/ConfirmationModal';
import { generateOrderMessage } from '../utils/messageFormatter';

interface SupplierCardProps {
  order: Order;
  isManagerView?: boolean;
  draggedItem?: { item: OrderItem; sourceOrderId: string } | null;
  setDraggedItem?: React.Dispatch<React.SetStateAction<{ item: OrderItem; sourceOrderId: string } | null>>;
  onItemDrop?: (destinationOrderId: string) => void;
  showStoreName?: boolean;
}

const SupplierCard: React.FC<SupplierCardProps> = ({
  order,
  isManagerView = false,
  draggedItem,
  setDraggedItem,
  onItemDrop,
  showStoreName = false,
}) => {
  const { actions } = useContext(AppContext);
  const { addToast } = useToasts();
  const cardRef = useRef<HTMLDivElement>(null);
  
  const [isAddItemModalOpen, setAddItemModalOpen] = useState(false);
  const [isNumpadOpen, setNumpadOpen] = useState(false);
  const [isMessageModalOpen, setMessageModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleUpdateItem = (quantity: number, unit?: Unit) => {
    if (selectedItem) {
      const updatedItems = order.items.map(i =>
        i.itemId === selectedItem.itemId ? { ...i, quantity, unit: unit ?? i.unit } : i
      );
      actions.updateOrder({ ...order, items: updatedItems });
      addToast(`${selectedItem.name} updated.`, 'success');
    }
    setNumpadOpen(false);
    setSelectedItem(null);
  };
  
  const handleAddItem = (newItem: OrderItem) => {
    const existingItem = order.items.find(i => i.itemId === newItem.itemId);
    let updatedItems;
    if (existingItem) {
        updatedItems = order.items.map(i =>
            i.itemId === newItem.itemId ? { ...i, quantity: i.quantity + newItem.quantity } : i
        );
    } else {
        updatedItems = [...order.items, newItem];
    }
    actions.updateOrder({ ...order, items: updatedItems });
  };

  const handleDeleteItemFromNumpad = () => {
    if (selectedItem) {
      const updatedItems = order.items.filter(i => i.itemId !== selectedItem.itemId);
      actions.updateOrder({ ...order, items: updatedItems });
      addToast(`${selectedItem.name} removed.`, 'success');
      setNumpadOpen(false);
      setSelectedItem(null);
    }
  };

  const handleUpdateStatus = async () => {
    if (order.status === OrderStatus.DISPATCHING) {
        if (order.items.length === 0) {
            addToast('Cannot send an empty order.', 'error');
            return;
        }
        const message = generateOrderMessage(order, 'html');
        await actions.sendOrderToStore(order, message);
        await actions.updateOrder({ ...order, status: OrderStatus.ON_THE_WAY, isSent: true });
        addToast(`Order for ${order.supplierName} sent to ${order.store}.`, 'success');

    } else if (order.status === OrderStatus.ON_THE_WAY) {
        await actions.updateOrder({ ...order, status: OrderStatus.COMPLETED, isReceived: true, completedAt: new Date().toISOString() });
        addToast(`Order for ${order.supplierName} marked as completed.`, 'success');
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = cardRef.current?.getBoundingClientRect();
    setContextMenu({ x: e.clientX, y: rect?.top ? Math.min(e.clientY, rect.top + 20) : e.clientY });
  };

  const contextMenuOptions = [
    { label: 'Send Order', action: () => setMessageModalOpen(true) },
    { label: 'Delete Order', action: () => setDeleteConfirmOpen(true), isDestructive: true },
  ];
  
  const cardColor = {
    [OrderStatus.DISPATCHING]: 'border-blue-500',
    [OrderStatus.ON_THE_WAY]: 'border-yellow-500',
    [OrderStatus.COMPLETED]: 'border-green-500',
  }[order.status];
  
  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, item: OrderItem) => {
    if (isManagerView || !setDraggedItem) return;
    setDraggedItem({ item, sourceOrderId: order.id });
    e.dataTransfer.effectAllowed = "move";
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    if (isManagerView || !draggedItem || draggedItem.sourceOrderId === order.id) return;
    e.preventDefault();
    setIsDraggingOver(true);
  };
  
  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isManagerView || !onItemDrop || !draggedItem || draggedItem.sourceOrderId === order.id) return;
    e.preventDefault();
    onItemDrop(order.id);
    setIsDraggingOver(false);
  };

  return (
    <>
      <div
        ref={cardRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-gray-800 rounded-xl shadow-lg flex flex-col p-0 border-t-4 transition-all duration-300 min-h-[220px] ${cardColor} ${isDraggingOver ? 'ring-2 ring-indigo-400' : ''}`}
      >
        <div className="flex justify-between items-center p-3" onContextMenu={!isManagerView ? handleContextMenu : undefined}>
          <h3 className="font-bold text-white truncate pr-2">
            {showStoreName && <span className="text-xs font-mono bg-gray-900/50 px-1.5 py-0.5 rounded-md mr-2 align-middle">{order.store}</span>}
            {order.supplierName}
          </h3>
          {!isManagerView && order.status === OrderStatus.DISPATCHING && (
            <button onClick={handleContextMenu} className="text-gray-500 hover:text-white p-1 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
            </button>
          )}
        </div>

        <div className="px-3 pb-2 flex-grow overflow-y-auto hide-scrollbar space-y-2">
          {order.items.sort((a,b) => a.name.localeCompare(b.name)).map(item => (
            <div
              key={item.itemId}
              draggable={!isManagerView && order.status !== OrderStatus.COMPLETED}
              onDragStart={(e) => handleDragStart(e, item)}
              onClick={() => {
                if (isManagerView) return;
                setSelectedItem(item);
                setNumpadOpen(true);
              }}
              className={`flex justify-between items-center p-2 rounded-md transition-colors duration-150 ${isManagerView ? 'cursor-default' : 'hover:bg-gray-700/70 cursor-pointer'}`}
            >
              <span className="text-gray-300 text-sm truncate pr-2">{item.name}</span>
              <span className="font-semibold text-white text-sm whitespace-nowrap">{item.quantity}{item.unit}</span>
            </div>
          ))}
          {order.items.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">No items yet.</div>
          )}
        </div>

        {!isManagerView && (
          <div className="p-2 border-t border-gray-700/50 flex items-center justify-center space-x-2">
            {order.status === OrderStatus.DISPATCHING && (
              <button onClick={() => setAddItemModalOpen(true)} className="flex-1 text-center py-2 px-3 text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:bg-gray-700/50 rounded-md">
                + Add Item
              </button>
            )}
            {order.status === OrderStatus.ON_THE_WAY && (
              <button onClick={handleUpdateStatus} className="flex-1 text-center py-2 px-3 text-sm font-medium text-green-400 hover:text-green-300 hover:bg-gray-700/50 rounded-md">
                Mark as Received
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Modals and Context Menu */}
      {!isManagerView && (
        <>
          <AddItemModal isOpen={isAddItemModalOpen} onClose={() => setAddItemModalOpen(false)} onAddItem={handleAddItem} order={order} />
          {selectedItem && (
            <NumpadModal isOpen={isNumpadOpen} onClose={() => setNumpadOpen(false)} onSave={handleUpdateItem} item={selectedItem} onDelete={handleDeleteItemFromNumpad} />
          )}
          {contextMenu && (
            <ContextMenu x={contextMenu.x} y={contextMenu.y} options={contextMenuOptions} onClose={() => setContextMenu(null)} />
          )}
          <OrderMessageModal isOpen={isMessageModalOpen} onClose={() => setMessageModalOpen(false)} order={order} />
          <ConfirmationModal
            isOpen={isDeleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}
            onConfirm={() => actions.deleteOrder(order.id)}
            title="Delete Order"
            message={`Are you sure you want to delete the order for ${order.supplierName}?`}
            isDestructive
            confirmText="Delete"
          />
        </>
      )}
    </>
  );
};

export default SupplierCard;
