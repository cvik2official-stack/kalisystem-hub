// FIX: Implemented the OrderWorkspace component to replace the placeholder content.
import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { OrderItem, OrderStatus, StoreName, Supplier, SupplierName } from '../types';
import { STATUS_TABS } from '../constants';
import SupplierCard from './SupplierCard';
import PasteItemsModal from './modals/PasteItemsModal';
import AddSupplierModal from './modals/AddSupplierModal';
import CompletedOrdersTable from './CompletedOrdersTable';
import { useToasts } from '../context/ToastContext';

const OrderWorkspace: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { addToast } = useToasts();
  const { activeStore, activeStatus, orders, settings } = state;
  const [isPasteModalOpen, setPasteModalOpen] = useState(false);
  const [isAddSupplierModalOpen, setAddSupplierModalOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{ item: OrderItem; sourceOrderId: string } | null>(null);
  const longPressTimer = useRef<number | null>(null);

  if (activeStore === 'Settings') return null;

  const handleStatusChange = (status: OrderStatus) => {
    dispatch({ type: 'SET_ACTIVE_STATUS', payload: status });
  };
  
  const handleAddOrder = (supplier: Supplier) => {
    // FIX: Removed redundant check for 'Settings'. The type of `activeStore` is already narrowed by the check at the top of the component.
    actions.addOrder(supplier, activeStore as StoreName);
    setAddSupplierModalOpen(false);
  };

  const handleItemDrop = async (destinationOrderId: string) => {
    if (!draggedItem) return;

    const { item: droppedItem, sourceOrderId } = draggedItem;

    // Prevent dropping on the same card
    if (sourceOrderId === destinationOrderId) {
        setDraggedItem(null);
        return;
    }

    const sourceOrder = state.orders.find(o => o.id === sourceOrderId);
    const destinationOrder = state.orders.find(o => o.id === destinationOrderId);

    if (!sourceOrder || !destinationOrder) {
        addToast('Error moving item: Order not found.', 'error');
        setDraggedItem(null);
        return;
    }
    
    // 1. Handle source order: Remove item, and delete order if it becomes empty on the "On The Way" tab
    const newSourceItems = sourceOrder.items.filter(i => i.itemId !== droppedItem.itemId);
    if (newSourceItems.length === 0 && sourceOrder.status === OrderStatus.ON_THE_WAY) {
      await actions.deleteOrder(sourceOrder.id);
      addToast(`Order for ${sourceOrder.supplierName} removed as it became empty.`, 'success');
    } else {
      await actions.updateOrder({ ...sourceOrder, items: newSourceItems });
    }

    // 2. Add item to destination order (check for duplicates and merge)
    const existingItemInDest = destinationOrder.items.find(i => i.itemId === droppedItem.itemId);
    let newDestinationItems;
    if (existingItemInDest) {
        // Item already exists, so update its quantity
        newDestinationItems = destinationOrder.items.map(i =>
            i.itemId === droppedItem.itemId
                ? { ...i, quantity: i.quantity + droppedItem.quantity }
                : i
        );
    } else {
        // Item doesn't exist, add it
        newDestinationItems = [...destinationOrder.items, droppedItem];
    }
    await actions.updateOrder({ ...destinationOrder, items: newDestinationItems });

    addToast(`${droppedItem.name} moved to ${destinationOrder.supplierName}.`, 'success');
    setDraggedItem(null);
  };


  const filteredOrders = orders.filter(order => {
    if (activeStore === 'KALI') {
        // Show all KALI supplier orders, regardless of store
        return order.supplierName === SupplierName.KALI && order.status === activeStatus;
    }
    // Original logic for store tabs
    return order.store === activeStore && order.status === activeStatus;
  });

  const handlePressStart = (tabId: OrderStatus) => {
    longPressTimer.current = window.setTimeout(() => {
      if (tabId === OrderStatus.DISPATCHING) {
        setPasteModalOpen(true);
// FIX: The component returns null if activeStore is 'Settings', so the check is redundant. This resolves the linting error.
      } else if (tabId === OrderStatus.COMPLETED) {
        if (activeStore !== 'KALI') {
          const spreadsheetId = settings.spreadsheetIds?.[activeStore];
          if (spreadsheetId) {
            window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`, '_blank');
          } else {
            addToast(`No spreadsheet ID configured for ${activeStore}.`, 'info');
          }
        }
      }
    }, 500);
  };

  const handlePressEnd = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };
  
  const canCreateOrders = activeStore !== 'KALI';

  return (
    <>
      <div className="mt-4 flex flex-col flex-grow">
        {/* Status Tabs */}
        <div className="border-b border-gray-700">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleStatusChange(tab.id)}
                onMouseDown={() => handlePressStart(tab.id)}
                onMouseUp={handlePressEnd}
                onMouseLeave={handlePressEnd}
                onTouchStart={() => handlePressStart(tab.id)}
                onTouchEnd={handlePressEnd}
                className={`
                  whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
                  ${
                    activeStatus === tab.id
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        
        {/* Orders Grid */}
        <div className="flex-grow pt-4 pb-4 overflow-y-auto hide-scrollbar">
            {filteredOrders.length === 0 ? (
                activeStatus === OrderStatus.DISPATCHING && canCreateOrders ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500 mb-4">No orders in this category.</p>
                        <button
                            onClick={() => setAddSupplierModalOpen(true)}
                            className="text-indigo-400 hover:text-indigo-300 font-medium text-sm"
                        >
                            + Add an Order
                        </button>
                        <span className="text-gray-600 mx-2">or</span>
                        <button
                            onClick={() => setPasteModalOpen(true)}
                            className="text-indigo-400 hover:text-indigo-300 font-medium text-sm"
                        >
                            Paste a List
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-gray-500">No orders in this category.</p>
                    </div>
                )
            ) : (
                activeStatus !== OrderStatus.COMPLETED ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {filteredOrders
                            .sort((a, b) => {
                                if (a.store !== b.store) {
                                    return a.store.localeCompare(b.store);
                                }
                                return a.supplierName.localeCompare(b.supplierName);
                            })
                            .map((order) => (
                                <SupplierCard
                                    key={order.id}
                                    order={order}
                                    draggedItem={draggedItem}
                                    setDraggedItem={setDraggedItem}
                                    onItemDrop={handleItemDrop}
                                    showStoreName={activeStore === 'KALI'}
                                />
                        ))}
                         {activeStatus === OrderStatus.DISPATCHING && canCreateOrders && (
                            <div className="bg-gray-800 rounded-xl shadow-lg flex flex-col items-center justify-center p-6 border-t-4 border-blue-500 transition-all duration-300 min-h-[220px]">
                                <div className="text-center flex flex-col items-center space-y-2">
                                    <button 
                                        onClick={() => setAddSupplierModalOpen(true)} 
                                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                                    >
                                        + select supplier
                                    </button>
                                    <p className="text-gray-600 text-xs">or</p>
                                    <button 
                                        onClick={() => setPasteModalOpen(true)}
                                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                                    >
                                        paste a list
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <CompletedOrdersTable orders={filteredOrders} />
                )
            )}
        </div>
      </div>
      
      <PasteItemsModal isOpen={isPasteModalOpen} onClose={() => setPasteModalOpen(false)} />
      <AddSupplierModal 
        isOpen={isAddSupplierModalOpen} 
        onClose={() => setAddSupplierModalOpen(false)} 
        onSelect={handleAddOrder}
        title="Create New Order For"
      />
    </>
  );
};

export default OrderWorkspace;