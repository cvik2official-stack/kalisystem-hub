import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { STATUS_TABS } from '../constants';
import SupplierCard from './SupplierCard';
import AddSupplierModal from './modals/AddSupplierModal';
import { Order, OrderItem, OrderStatus, Supplier } from '../types';
import PasteItemsModal from './modals/PasteItemsModal';

const formatDateGroupHeader = (key: string): string => {
  if (key === 'Today') return 'Today';
  const date = new Date(key);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  return `${day}.${month}.${year}`;
};

const OrderWorkspace: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { activeStore, activeStatus, orders } = state;

  const [isAddSupplierModalOpen, setAddSupplierModalOpen] = useState(false);
  const [isPasteModalOpen, setPasteModalOpen] = useState(false);
  
  // State for drag and drop
  const [draggedItem, setDraggedItem] = useState<{ item: OrderItem; sourceOrderId: string } | null>(null);
  const [itemForNewOrder, setItemForNewOrder] = useState<{ item: OrderItem; sourceOrderId: string } | null>(null);
  const [isDragOverEmpty, setIsDragOverEmpty] = useState(false);

  // State for completed orders view
  const [expandedGroups, setExpandedGroups] = useState(new Set<string>());


  const handleStatusChange = (status: OrderStatus) => {
    dispatch({ type: 'SET_ACTIVE_STATUS', payload: status });
  };

  const handleAddOrder = async (supplier: Supplier) => {
    if (activeStore === 'Settings' || !activeStore) return;
    await actions.addOrder(supplier, activeStore);
    setAddSupplierModalOpen(false);
  };
  
  const handleItemDrop = async (destinationOrderId: string) => {
    if (!draggedItem) return;

    const sourceOrder = orders.find(o => o.id === draggedItem.sourceOrderId);
    const destinationOrder = orders.find(o => o.id === destinationOrderId);
    
    const canDrop = sourceOrder && 
                    destinationOrder && 
                    sourceOrder.id !== destinationOrder.id &&
                    sourceOrder.status === destinationOrder.status && // Ensure items are moved between orders of the same status
                    (destinationOrder.status === OrderStatus.DISPATCHING || destinationOrder.status === OrderStatus.ON_THE_WAY);

    if (canDrop) {
        // Calculate new states before dispatching to prevent race conditions
        const newSourceItems = sourceOrder.items.filter(i => i.itemId !== draggedItem.item.itemId);
        
        const itemExistsInDest = destinationOrder.items.some(i => i.itemId === draggedItem.item.itemId);
        const isUpdateToSentOrder = destinationOrder.status === OrderStatus.ON_THE_WAY;
        const itemToDrop = { ...draggedItem.item, isNew: isUpdateToSentOrder };

        const newDestinationItems = itemExistsInDest
            ? destinationOrder.items.map(i => 
                i.itemId === draggedItem.item.itemId 
                ? { ...i, quantity: i.quantity + itemToDrop.quantity, isNew: isUpdateToSentOrder || i.isNew } 
                : i
            )
            : [...destinationOrder.items, itemToDrop];

        try {
            // Update both orders concurrently
            await Promise.all([
                actions.updateOrder({ ...sourceOrder, items: newSourceItems }),
                actions.updateOrder({ ...destinationOrder, items: newDestinationItems })
            ]);
        } catch (error) {
            console.error("Failed to move item between orders:", error);
        }
    }
    setDraggedItem(null);
  };
  
  const handleDropOnEmptySpace = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedItem) {
      setItemForNewOrder(draggedItem);
      setAddSupplierModalOpen(true);
    }
    setIsDragOverEmpty(false);
    setDraggedItem(null);
  };

  const handleCreateOrderFromDrop = async (supplier: Supplier) => {
    if (!itemForNewOrder || activeStore === 'Settings') return;

    const sourceOrder = orders.find(o => o.id === itemForNewOrder.sourceOrderId);
    if (sourceOrder) {
      const updatedSourceItems = sourceOrder.items.filter(i => i.itemId !== itemForNewOrder.item.itemId);
      await actions.updateOrder({ ...sourceOrder, items: updatedSourceItems });
      await actions.addOrder(supplier, activeStore, [itemForNewOrder.item]);
    }
    
    setAddSupplierModalOpen(false);
    setItemForNewOrder(null);
  };

  const filteredOrders = useMemo(() => {
    if (activeStore === 'Settings') return [];
    return orders
      .filter(order => order.store === activeStore && order.status === activeStatus)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, activeStore, activeStatus]);
  
  const groupedCompletedOrders = useMemo(() => {
    if (activeStatus !== OrderStatus.COMPLETED) return {};
    const groups: Record<string, Order[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filteredOrders.forEach(order => {
      const completedDate = new Date(order.completedAt || 0);
      completedDate.setHours(0, 0, 0, 0);
      const key = completedDate.getTime() === today.getTime() ? 'Today' : completedDate.toISOString().split('T')[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });
    return groups;
  }, [filteredOrders, activeStatus]);

  const sortedCompletedGroupKeys = useMemo(() => {
    return Object.keys(groupedCompletedOrders).sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      return new Date(b).getTime() - new Date(a).getTime();
    });
  }, [groupedCompletedOrders]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  return (
    <>
      <div className="mt-6 border-b border-gray-700">
        <nav className="-mb-px flex space-x-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleStatusChange(tab.id)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                activeStatus === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      
      <div
        className={`flex-grow pt-2 pb-4 overflow-y-auto hide-scrollbar relative transition-all duration-200
          ${isDragOverEmpty ? 'border-2 border-dashed border-indigo-500 bg-gray-800/50 rounded-lg' : 'border-2 border-transparent'}
        `}
        onDragOver={(e) => {
          if (draggedItem && activeStatus === OrderStatus.DISPATCHING && e.target === e.currentTarget) {
            e.preventDefault();
            setIsDragOverEmpty(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.target === e.currentTarget) {
            setIsDragOverEmpty(false);
          }
        }}
        onDrop={handleDropOnEmptySpace}
      >
        {isDragOverEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-indigo-400 font-semibold">Drop to create new order</p>
          </div>
        )}

          {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                  <p className="text-gray-500">No orders in this category.</p>
              </div>
          ) : activeStatus === OrderStatus.COMPLETED ? (
              <div className="mt-4 space-y-2">
                {sortedCompletedGroupKeys.map(key => {
                  const isExpanded = expandedGroups.has(key);
                  return (
                    <div key={key}>
                      <button
                        onClick={() => toggleGroup(key)}
                        className="bg-gray-900/50 px-4 py-2 flex justify-between items-center border-b border-t border-gray-700 w-full text-left"
                      >
                        <div className="flex items-center space-x-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-400 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          <h3 className="font-semibold text-white">{formatDateGroupHeader(key)}</h3>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                          {groupedCompletedOrders[key].map((order) => (
                            <SupplierCard key={order.id} order={order} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            {filteredOrders.map((order) => (
                <SupplierCard 
                    key={order.id} 
                    order={order} 
                    draggedItem={draggedItem}
                    setDraggedItem={setDraggedItem}
                    onItemDrop={handleItemDrop}
                />
            ))}
            </div>
          )}
      </div>

      {activeStatus === OrderStatus.DISPATCHING && activeStore !== 'Settings' && (
        <div className="flex-shrink-0 p-2 border-t border-gray-700/50 flex items-center justify-center space-x-2">
           <button 
             onClick={() => setAddSupplierModalOpen(true)} 
             className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 px-4 rounded-md text-sm transition-colors"
           >
             + Add Order
           </button>
           <button 
             onClick={() => setPasteModalOpen(true)} 
             className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md text-sm transition-colors"
           >
             Paste List
           </button>
        </div>
      )}

      <AddSupplierModal
        isOpen={isAddSupplierModalOpen}
        onClose={() => {
            setAddSupplierModalOpen(false);
            setItemForNewOrder(null);
        }}
        onSelect={itemForNewOrder ? handleCreateOrderFromDrop : handleAddOrder}
        title={itemForNewOrder ? "Select Supplier for New Order" : "Start a New Order"}
      />
      <PasteItemsModal
        isOpen={isPasteModalOpen}
        onClose={() => setPasteModalOpen(false)}
      />
    </>
  );
};

export default OrderWorkspace;