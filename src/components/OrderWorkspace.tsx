import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { STATUS_TABS } from '../constants';
import SupplierCard from './SupplierCard';
import AddSupplierModal from './modals/AddSupplierModal';
import { Order, OrderItem, OrderStatus, Supplier, StoreName, PaymentMethod, SupplierName } from '../types';
import PasteItemsModal from './modals/PasteItemsModal';
import ContextMenu from './ContextMenu';
import { useNotifier } from '../context/NotificationContext';
import { generateStoreReport } from '../utils/messageFormatter';
import DueReportModal from './modals/DueReportModal';
import ReceiptModal from './modals/ReceiptModal';

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
  const { activeStore, orders, suppliers, isEditModeEnabled, draggedOrderId, columnCount, activeStatus, draggedItem } = state;
  const { notify } = useNotifier();

  const [isAddSupplierModalOpen, setAddSupplierModalOpen] = useState(false);
  const [isPasteModalOpen, setPasteModalOpen] = useState(false);
  
  const [itemForNewOrder, setItemForNewOrder] = useState<{ item: OrderItem; sourceOrderId: string } | null>(null);
  const [isDragOverEmpty, setIsDragOverEmpty] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState(new Set<string>(['Today']));
  const [headerContextMenu, setHeaderContextMenu] = useState<{ x: number, y: number, dateGroupKey: string } | null>(null);
  const [isDueReportModalOpen, setIsDueReportModalOpen] = useState(false);
  const [ordersForDueReport, setOrdersForDueReport] = useState<Order[]>([]);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [ordersForReceipt, setOrdersForReceipt] = useState<Order[]>([]);
  const [dragOverColumn, setDragOverColumn] = useState<OrderStatus | null>(null);
  const [dragOverStatusTab, setDragOverStatusTab] = useState<OrderStatus | null>(null);
  const [dragOverDateGroup, setDragOverDateGroup] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = 0; // Reset endX on new touch
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === 0 || touchEndX.current === 0) return;
    const swipeDistance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = swipeDistance > 75; // Minimum swipe distance
    const isRightSwipe = swipeDistance < -75;

    if (isLeftSwipe || isRightSwipe) {
        const currentIndex = STATUS_TABS.findIndex(tab => tab.id === activeStatus);
        if (isLeftSwipe && currentIndex < STATUS_TABS.length - 1) {
            dispatch({ type: 'SET_ACTIVE_STATUS', payload: STATUS_TABS[currentIndex + 1].id });
        } else if (isRightSwipe && currentIndex > 0) {
            dispatch({ type: 'SET_ACTIVE_STATUS', payload: STATUS_TABS[currentIndex - 1].id });
        }
    }
    // Reset refs
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const handleAddOrder = async (supplier: Supplier) => {
    if (activeStore === 'Settings' || !activeStore) return;
    await actions.addOrder(supplier, activeStore, [], OrderStatus.DISPATCHING);
    setAddSupplierModalOpen(false);
  };
  
  const handleItemDropOnCard = async (destinationOrderId: string) => {
    if (!draggedItem) return;

    const { item: droppedItem, sourceOrderId } = draggedItem;
    
    // Prevent dropping on itself
    if (sourceOrderId === destinationOrderId) {
        dispatch({ type: 'SET_DRAGGED_ITEM', payload: null });
        return;
    }

    const sourceOrder = state.orders.find(o => o.id === sourceOrderId);
    const destinationOrder = state.orders.find(o => o.id === destinationOrderId);

    if (!sourceOrder || !destinationOrder) {
        notify('Drag-and-drop error: order not found.', 'error');
        dispatch({ type: 'SET_DRAGGED_ITEM', payload: null });
        return;
    }
    
    // Permission Check: Cannot modify completed orders without edit mode
    if ((sourceOrder.status === OrderStatus.COMPLETED && !isEditModeEnabled) || (destinationOrder.status === OrderStatus.COMPLETED && !isEditModeEnabled)) {
        notify('Enable Edit Mode to modify completed orders.', 'info');
        dispatch({ type: 'SET_DRAGGED_ITEM', payload: null });
        return;
    }

    // --- Update Source Order ---
    const newSourceItems = sourceOrder.items.filter(i => 
        // A more robust check for item identity
        !(i.itemId === droppedItem.itemId && i.isSpoiled === droppedItem.isSpoiled && i.name === droppedItem.name)
    );

    // --- Update Destination Order ---
    const newDestinationItems = [...destinationOrder.items];
    const existingItemIndex = newDestinationItems.findIndex(i => 
        i.itemId === droppedItem.itemId && i.isSpoiled === droppedItem.isSpoiled
    );
    
    // Add 'isNew' flag if dropping onto an "On The Way" order
    const itemToDrop = { ...droppedItem, isNew: destinationOrder.status === OrderStatus.ON_THE_WAY };

    if (existingItemIndex > -1) {
        // Merge with existing item
        const existingItem = newDestinationItems[existingItemIndex];
        newDestinationItems[existingItemIndex] = {
            ...existingItem,
            quantity: existingItem.quantity + itemToDrop.quantity,
            isNew: destinationOrder.status === OrderStatus.ON_THE_WAY || existingItem.isNew,
        };
    } else {
        // Add as a new item
        newDestinationItems.push(itemToDrop);
    }
    
    // --- Commit changes via actions ---
    try {
        // If source order becomes empty, delete it. Otherwise, update it.
        if (newSourceItems.length === 0) {
            await actions.deleteOrder(sourceOrderId);
        } else {
            await actions.updateOrder({ ...sourceOrder, items: newSourceItems });
        }

        await actions.updateOrder({ ...destinationOrder, items: newDestinationItems });
    } catch (e) {
        // The context wrapper already shows a notification
        console.error("Failed to move item:", e);
    } finally {
        // Clean up global drag state
        dispatch({ type: 'SET_DRAGGED_ITEM', payload: null });
    }
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
  
  const handleGenerateStoreReport = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysCompletedOrders = orders.filter(o => {
      if (o.status !== OrderStatus.COMPLETED || !o.completedAt || o.store !== activeStore) return false;
      const completedDate = new Date(o.completedAt);
      completedDate.setHours(0, 0, 0, 0);
      return completedDate.getTime() === today.getTime();
    });
    
    if (todaysCompletedOrders.length === 0) {
        notify("No completed orders for today to generate a report.", 'info');
        return;
    }
    
    const reportText = generateStoreReport(todaysCompletedOrders);
    navigator.clipboard.writeText(reportText).then(() => {
        notify('Store report copied to clipboard!', 'success');
    }).catch(err => {
        notify(`Failed to copy report: ${err}`, 'error');
    });
  };

  const getFilteredOrdersForStatus = (status: OrderStatus) => {
      if (activeStore === 'Settings') return [];
  
      let filtered: Order[];
  
      if (activeStore === StoreName.OUDOM) {
          filtered = orders.filter(order => 
              (order.supplierName === SupplierName.OUDOM || order.supplierName === SupplierName.STOCK) &&
              order.status === status
          );
      } else if (activeStore === StoreName.KALI) {
          filtered = orders.filter(order => {
              const supplier = suppliers.find(s => s.id === order.supplierId);
              const effectivePaymentMethod = order.paymentMethod || supplier?.paymentMethod;
              return effectivePaymentMethod === PaymentMethod.KALI && order.status === status;
          });
      } else {
          filtered = orders.filter(order => order.store === activeStore && order.status === status);
      }
      
      return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };
  
  const groupedCompletedOrders = useMemo(() => {
    const ordersToGroup = getFilteredOrdersForStatus(OrderStatus.COMPLETED);
    if (ordersToGroup.length === 0) return {};
    
    const groups: Record<string, Order[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    ordersToGroup.forEach(order => {
      const completedDate = new Date(order.completedAt || 0);
      completedDate.setHours(0, 0, 0, 0);
      const key = completedDate.getTime() === today.getTime() ? 'Today' : completedDate.toISOString().split('T')[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });
    return groups;
  }, [orders, activeStore, suppliers]);

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
  
  const handleGenerateDueReportForGroup = (dateGroupKey: string) => {
    const ordersForGroup = groupedCompletedOrders[dateGroupKey] || [];
    if (ordersForGroup.length === 0) {
        notify(`No completed orders for ${formatDateGroupHeader(dateGroupKey)} to generate a report.`, 'info');
        return;
    }
    setOrdersForDueReport(ordersForGroup);
    setIsDueReportModalOpen(true);
  };
  
  const handleGenerateReceiptForGroup = (dateGroupKey: string) => {
    const ordersForGroup = groupedCompletedOrders[dateGroupKey] || [];
     if (ordersForGroup.length === 0) {
        notify(`No completed orders for ${formatDateGroupHeader(dateGroupKey)} to generate a receipt.`, 'info');
        return;
    }
    setOrdersForReceipt(ordersForGroup);
    setIsReceiptModalOpen(true);
  };

  const getMenuOptionsForDateGroup = (dateGroupKey: string) => {
    const options = [];
    
    options.push({ label: isEditModeEnabled ? 'Disable Edit' : 'Enable Edit', action: () => dispatch({ type: 'SET_EDIT_MODE', payload: !isEditModeEnabled }) });

    if (dateGroupKey === 'Today') {
        options.push(
            { label: 'New Card...', action: () => setAddSupplierModalOpen(true) },
            { label: 'Store Report', action: handleGenerateStoreReport }
        );
    }
    
    options.push({ label: 'Due Report...', action: () => handleGenerateDueReportForGroup(dateGroupKey) });
    options.push({ label: 'Receipt...', action: () => handleGenerateReceiptForGroup(dateGroupKey) });

    return options;
  };

  const handleDropOnDateGroup = (key: string) => {
    if (!draggedOrderId) return;
    const orderToMove = orders.find(o => o.id === draggedOrderId);
    if (!orderToMove || orderToMove.status !== OrderStatus.COMPLETED) return;

    const targetDate = new Date(key === 'Today' ? new Date() : new Date(key));
    
    const originalCompletedTime = new Date(orderToMove.completedAt || 0);
    targetDate.setHours(
        originalCompletedTime.getHours(),
        originalCompletedTime.getMinutes(),
        originalCompletedTime.getSeconds()
    );

    actions.updateOrder({ ...orderToMove, completedAt: targetDate.toISOString() });
    dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: null });
    setDragOverDateGroup(null);
  }

  const handleDropOnStatus = (status: OrderStatus) => {
    if (draggedOrderId) {
      const sourceOrder = orders.find((o) => o.id === draggedOrderId);
      if (sourceOrder && sourceOrder.status !== status) {
        const updatedOrder: Partial<Order> & { id: string } = { ...sourceOrder, status };
        if (status === OrderStatus.DISPATCHING) {
          updatedOrder.isSent = false;
          updatedOrder.isReceived = false;
          updatedOrder.completedAt = undefined;
        } else if (status === OrderStatus.ON_THE_WAY) {
          updatedOrder.isSent = true;
          updatedOrder.isReceived = false;
          updatedOrder.completedAt = undefined;
        } else if (status === OrderStatus.COMPLETED) {
          updatedOrder.isSent = true;
          updatedOrder.isReceived = true;
          updatedOrder.completedAt = new Date().toISOString();
        }
        actions.updateOrder(updatedOrder as Order);
      }
      setDragOverColumn(null);
      setDragOverStatusTab(null);
      dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: null });
    }
  };

  const AddOrderDropZone = () => (
    <div
      className={`bg-gray-800 rounded-xl shadow-lg flex flex-col border-2 border-dashed items-center justify-center p-4 min-h-[10rem] transition-colors duration-200 w-full max-w-sm
        ${isDragOverEmpty ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-700'}
      `}
       onDragOver={(e) => {
        if (draggedItem) {
          e.preventDefault();
          setIsDragOverEmpty(true);
        }
      }}
      onDragLeave={() => setIsDragOverEmpty(false)}
      onDrop={(e) => {
        e.preventDefault();
        if (draggedItem) {
          setItemForNewOrder(draggedItem);
          setAddSupplierModalOpen(true);
        }
        setIsDragOverEmpty(false);
        dispatch({ type: 'SET_DRAGGED_ITEM', payload: null });
      }}
    >
        <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
           <button 
             onClick={() => setAddSupplierModalOpen(true)} 
             className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors text-lg pointer-events-auto"
           >
             + select supplier
           </button>
           <span className="text-gray-500 text-xs">or</span>
           <button 
             onClick={() => setPasteModalOpen(true)} 
             className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors text-lg pointer-events-auto"
           >
             paste a list
           </button>
        </div>
    </div>
  );

  const DispatchingColumnContent = () => {
    const dispatchingOrders = getFilteredOrdersForStatus(OrderStatus.DISPATCHING);
    return (
      <>
        {dispatchingOrders.map(order => (
          <SupplierCard 
              key={order.id} 
              order={order} 
              onItemDrop={handleItemDropOnCard}
              showStoreName={activeStore === StoreName.KALI}
          />
        ))}
        <AddOrderDropZone />
      </>
    );
  };
  
  const OnTheWayColumnContent = () => {
    const onTheWayOrders = getFilteredOrdersForStatus(OrderStatus.ON_THE_WAY);
    return (
      <>
        {onTheWayOrders.map(order => (
          <SupplierCard 
              key={order.id} 
              order={order} 
              onItemDrop={handleItemDropOnCard}
              showStoreName={activeStore === StoreName.KALI}
          />
        ))}
        {onTheWayOrders.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No orders on the way.</p>
            </div>
        )}
      </>
    );
  };
  
  const renderCompletedColumn = () => (
    <>
      {sortedCompletedGroupKeys.length > 0 ? (
        <div className="space-y-1">
          {sortedCompletedGroupKeys.map(key => {
            const isExpanded = expandedGroups.has(key);
            return (
              <div 
                key={key}
                onDragOver={(e) => {
                  const orderToMove = orders.find(o => o.id === draggedOrderId);
                  if (orderToMove && orderToMove.status === OrderStatus.COMPLETED) {
                      e.preventDefault();
                      setDragOverDateGroup(key);
                  }
                }}
                onDragLeave={() => setDragOverDateGroup(null)}
                onDrop={(e) => { e.preventDefault(); handleDropOnDateGroup(key); }}
              >
                <div className={`bg-gray-800 px-1 py-1 flex justify-between items-center w-full text-left rounded-xl transition-colors ${dragOverDateGroup === key ? 'bg-indigo-900/50' : ''}`}>
                  <button onClick={() => toggleGroup(key)} className="flex items-center space-x-1 flex-grow p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-400 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <h3 className="font-bold text-white text-base">{formatDateGroupHeader(key)}</h3>
                  </button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setHeaderContextMenu({ x: rect.left, y: rect.bottom + 5, dateGroupKey: key }); }} className="p-1 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white" aria-label="Date Group Actions">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                  </button>
                </div>
                {isExpanded && (
                  <div className="space-y-4 p-2">
                    {groupedCompletedOrders[key].map((order) => (
                      <SupplierCard 
                          key={order.id} 
                          order={order}
                          onItemDrop={handleItemDropOnCard}
                          showStoreName={activeStore === StoreName.KALI} 
                          isEditModeEnabled={isEditModeEnabled}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">No completed orders.</p>
        </div>
      )}
    </>
  );

  const renderStatusContent = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.DISPATCHING:
        return <DispatchingColumnContent />;
      case OrderStatus.ON_THE_WAY:
        return <OnTheWayColumnContent />;
      case OrderStatus.COMPLETED:
        return renderCompletedColumn();
      default:
        return null;
    }
  };

  if (columnCount === 1) {
    return (
      <div className="flex-grow pt-4 flex flex-col">
        <nav className="-mb-px flex space-x-6 px-3">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_STATUS', payload: tab.id })}
              onDragOver={(e) => { if (draggedOrderId) { e.preventDefault(); setDragOverStatusTab(tab.id); }}}
              onDragLeave={() => setDragOverStatusTab(null)}
              onDrop={(e) => { e.preventDefault(); handleDropOnStatus(tab.id); }}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors rounded-t-md ${
                activeStatus === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
              } ${dragOverStatusTab === tab.id ? 'bg-indigo-900/50' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div
          className="mt-4 flex-grow overflow-y-auto hide-scrollbar px-2 pb-2"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
            <div className="grid grid-cols-1 gap-4">
              {renderStatusContent(activeStatus)}
            </div>
        </div>
        <AddSupplierModal isOpen={isAddSupplierModalOpen} onClose={() => { setAddSupplierModalOpen(false); setItemForNewOrder(null); }} onSelect={itemForNewOrder ? handleCreateOrderFromDrop : handleAddOrder} title={itemForNewOrder ? "Select Supplier for New Order" : "Start a New Order"} />
        <PasteItemsModal isOpen={isPasteModalOpen} onClose={() => setPasteModalOpen(false)} />
        {headerContextMenu && <ContextMenu x={headerContextMenu.x} y={headerContextMenu.y} options={getMenuOptionsForDateGroup(headerContextMenu.dateGroupKey)} onClose={() => setHeaderContextMenu(null)} />}
        <DueReportModal isOpen={isDueReportModalOpen} onClose={() => setIsDueReportModalOpen(false)} orders={ordersForDueReport} />
        <ReceiptModal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} orders={ordersForReceipt} />
      </div>
    );
  }

  // Always use a 3-column grid for the multi-column layout to keep spacing consistent.
  // We will conditionally render the columns inside the map based on `columnCount`.
  const gridColsClass = 'grid-cols-3';

  return (
    <div className="flex-grow pt-4 overflow-x-auto hide-scrollbar">
      <div className={`h-full grid ${gridColsClass} gap-4 min-w-[900px] xl:min-w-full`}>
        {STATUS_TABS.map((tab, index) => {
          // When in 2-column view, do not render the third column ("Completed").
          if (columnCount === 2 && index === 2) return null;
          return (
            <section
              key={tab.id}
              className={`flex flex-col bg-gray-900/50 rounded-lg transition-colors ${dragOverColumn === tab.id ? 'bg-indigo-900/50' : ''}`}
              onDragOver={(e) => {
                if (draggedOrderId) {
                  const sourceOrder = orders.find((o) => o.id === draggedOrderId);
                  if (sourceOrder && sourceOrder.status !== tab.id) {
                    e.preventDefault();
                    setDragOverColumn(tab.id);
                  }
                }
              }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => { e.preventDefault(); handleDropOnStatus(tab.id); }}
            >
              <h2 className="text-lg font-semibold text-white p-3">{tab.label}</h2>
              <div className="flex-grow overflow-y-auto hide-scrollbar px-2 pb-2">
                <div className="grid grid-cols-1 gap-4">
                    {renderStatusContent(tab.id)}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      
      <AddSupplierModal isOpen={isAddSupplierModalOpen} onClose={() => { setAddSupplierModalOpen(false); setItemForNewOrder(null); }} onSelect={itemForNewOrder ? handleCreateOrderFromDrop : handleAddOrder} title={itemForNewOrder ? "Select Supplier for New Order" : "Start a New Order"} />
      <PasteItemsModal isOpen={isPasteModalOpen} onClose={() => setPasteModalOpen(false)} />
      {headerContextMenu && <ContextMenu x={headerContextMenu.x} y={headerContextMenu.y} options={getMenuOptionsForDateGroup(headerContextMenu.dateGroupKey)} onClose={() => setHeaderContextMenu(null)} />}
      <DueReportModal isOpen={isDueReportModalOpen} onClose={() => setIsDueReportModalOpen(false)} orders={ordersForDueReport} />
      <ReceiptModal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} orders={ordersForReceipt} />
    </div>
  );
};

export default OrderWorkspace;