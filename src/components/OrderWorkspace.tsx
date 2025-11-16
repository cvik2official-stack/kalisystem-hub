import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { STATUS_TABS } from '../constants';
import SupplierCard from '../components/SupplierCard';
import AddSupplierModal from './modals/AddSupplierModal';
import { Order, OrderItem, OrderStatus, Supplier, StoreName, PaymentMethod, SupplierName, Unit, ItemPrice } from '../types';
import PasteItemsModal from './modals/PasteItemsModal';
import ContextMenu from '../components/ContextMenu';
import { useNotifier } from '../context/NotificationContext';
import { generateStoreReport } from '../utils/messageFormatter';
import DueReportModal from './modals/DueReportModal';
import ReceiptModal from './modals/ReceiptModal';
import ManagerReportView from './ManagerReportView';

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
  const { activeStore, orders, suppliers, draggedOrderId, columnCount, activeStatus, draggedItem, isSmartView, itemPrices } = state;
  const { notify } = useNotifier();

  const [isSupplierSelectModalOpen, setSupplierSelectModalOpen] = useState(false);
  const [isPasteModalOpen, setPasteModalOpen] = useState(false);
  
  const [itemForNewOrder, setItemForNewOrder] = useState<{ item: OrderItem; sourceOrderId: string } | null>(null);
  const [orderToChange, setOrderToChange] = useState<Order | null>(null);
  const [isDragOverEmpty, setIsDragOverEmpty] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Today', 'Yesterday']));
  const [showAllCompleted, setShowAllCompleted] = useState(false);

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
  const [completedViewMode, setCompletedViewMode] = useState<'card' | 'report'>('card');

  const [smartViewPage, setSmartViewPage] = useState(0); 
  const swipeContainerRef = useRef<HTMLDivElement>(null);


  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = 0; 
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (isSmartView) {
        if (swipeContainerRef.current && window.innerWidth < 768) {
            const swipeDistance = touchStartX.current - touchEndX.current;
            if (swipeDistance > 75 && smartViewPage === 0) setSmartViewPage(1); // Swipe left
            if (swipeDistance < -75 && smartViewPage === 1) setSmartViewPage(0); // Swipe right
        }
        return;
    }

    if (touchStartX.current === 0 || touchEndX.current === 0) return;
    const swipeDistance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = swipeDistance > 75;
    const isRightSwipe = swipeDistance < -75;

    if (isLeftSwipe || isRightSwipe) {
        const currentIndex = STATUS_TABS.findIndex(tab => tab.id === activeStatus);
        if (isLeftSwipe && currentIndex < STATUS_TABS.length - 1) {
            dispatch({ type: 'SET_ACTIVE_STATUS', payload: STATUS_TABS[currentIndex + 1].id });
        } else if (isRightSwipe && currentIndex > 0) {
            dispatch({ type: 'SET_ACTIVE_STATUS', payload: STATUS_TABS[currentIndex - 1].id });
        }
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };
  
  const handleCompletedTabClick = (e: React.MouseEvent) => {
    const isHeaderClick = (e.target as HTMLElement).tagName.toLowerCase() === 'h2';
    if (activeStatus === OrderStatus.COMPLETED || isHeaderClick) {
        setCompletedViewMode(prev => prev === 'card' ? 'report' : 'card');
    } 
    if (activeStatus !== OrderStatus.COMPLETED) {
        dispatch({ type: 'SET_ACTIVE_STATUS', payload: OrderStatus.COMPLETED });
        setCompletedViewMode('card');
    }
  };

  const handleAddOrder = async (supplier: Supplier) => {
    if (activeStore === 'Settings' || !activeStore) return;
    await actions.addOrder(supplier, activeStore, [], OrderStatus.DISPATCHING);
    setSupplierSelectModalOpen(false);
  };
  
  const handleItemDropOnCard = async (destinationOrderId: string) => {
    if (!draggedItem) return;

    const { item: droppedItem, sourceOrderId } = draggedItem;
    
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
    
    const newSourceItems = sourceOrder.items.filter(i => 
        !(i.itemId === droppedItem.itemId && i.isSpoiled === droppedItem.isSpoiled && i.name === droppedItem.name)
    );

    const newDestinationItems = [...destinationOrder.items];
    const existingItemIndex = newDestinationItems.findIndex(i => 
        i.itemId === droppedItem.itemId && i.isSpoiled === droppedItem.isSpoiled
    );
    
    const itemToDrop = { ...droppedItem, isNew: destinationOrder.status === OrderStatus.ON_THE_WAY };

    if (existingItemIndex > -1) {
        const existingItem = newDestinationItems[existingItemIndex];
        newDestinationItems[existingItemIndex] = {
            ...existingItem,
            quantity: existingItem.quantity + itemToDrop.quantity,
            isNew: destinationOrder.status === OrderStatus.ON_THE_WAY || existingItem.isNew,
        };
    } else {
        newDestinationItems.push(itemToDrop);
    }
    
    try {
        await actions.updateOrder({ ...sourceOrder, items: newSourceItems });
        await actions.updateOrder({ ...destinationOrder, items: newDestinationItems });
    } catch (e) {
        console.error("Failed to move item:", e);
    } finally {
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
    
    setSupplierSelectModalOpen(false);
    setItemForNewOrder(null);
  };

  const handleChangeSupplierForOrder = async (newSupplier: Supplier) => {
    if (!orderToChange) return;
    
    let supplierToUse = newSupplier;
    if (newSupplier.id.startsWith('new_')) {
        const newSupplierFromDb = await actions.addSupplier({ name: newSupplier.name });
        supplierToUse = newSupplierFromDb;
    }
    await actions.updateOrder({ ...orderToChange, supplierId: supplierToUse.id, supplierName: supplierToUse.name, paymentMethod: supplierToUse.paymentMethod });

    setSupplierSelectModalOpen(false);
    setOrderToChange(null);
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
  
      if (activeStore === StoreName.KALI) {
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

  const visibleCompletedGroupKeys = useMemo(() => {
    if (showAllCompleted) return sortedCompletedGroupKeys;
    return sortedCompletedGroupKeys.filter(key => key === 'Today' || formatDateGroupHeader(key) === 'Yesterday');
  }, [sortedCompletedGroupKeys, showAllCompleted]);

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
    
    if (dateGroupKey === 'Today') {
        options.push(
            { label: 'New Card...', action: () => setSupplierSelectModalOpen(true) },
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
    if (!orderToMove) return;

    const targetDate = new Date(key === 'Today' ? new Date() : new Date(key));
    
    const originalCompletedTime = new Date(orderToMove.completedAt || 0);
    targetDate.setHours(
        originalCompletedTime.getHours(),
        originalCompletedTime.getMinutes(),
        originalCompletedTime.getSeconds()
    );

    const updatePayload: Partial<Order> & { id: string } = { ...orderToMove, completedAt: targetDate.toISOString() };
    if (orderToMove.status !== OrderStatus.COMPLETED) {
        updatePayload.status = OrderStatus.COMPLETED;
        updatePayload.isSent = true;
        updatePayload.isReceived = true;
    }
    actions.updateOrder(updatePayload as Order);

    dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: null });
    setDragOverDateGroup(null);
  }
  
  const handleDragOverDateGroup = (e: React.DragEvent, key: string) => {
    const orderToMove = orders.find(o => o.id === draggedOrderId);
    if (!orderToMove) return;

    // Allow any order to be dropped here now.
    e.preventDefault();
    setDragOverDateGroup(key);
};

  const handleDropOnStatus = (status: OrderStatus) => {
    if (draggedOrderId) {
      const sourceOrder = orders.find((o) => o.id === draggedOrderId);
      if (sourceOrder) {
        if (sourceOrder.status !== status) {
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
        if (draggedItem || (draggedOrderId && state.orders.find(o => o.id === draggedOrderId)?.status === OrderStatus.DISPATCHING)) {
          e.preventDefault();
          setIsDragOverEmpty(true);
        }
      }}
      onDragLeave={() => setIsDragOverEmpty(false)}
      onDrop={(e) => {
        e.preventDefault();
        if (draggedItem) {
          setItemForNewOrder(draggedItem);
          setSupplierSelectModalOpen(true);
        } else if (draggedOrderId) {
            const order = orders.find(o => o.id === draggedOrderId);
            if(order) {
                setOrderToChange(order);
                setSupplierSelectModalOpen(true);
            }
        }
        setIsDragOverEmpty(false);
        dispatch({ type: 'SET_DRAGGED_ITEM', payload: null });
        dispatch({ type: 'SET_DRAGGED_ORDER_ID', payload: null });
      }}
    >
        <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
           <button 
             onClick={() => setSupplierSelectModalOpen(true)} 
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
  
  const renderCompletedColumn = () => {
    if (completedViewMode === 'report' && activeStore !== 'Settings') {
        const todaysCompletedOrders = groupedCompletedOrders['Today'] || [];
        return <ManagerReportView orders={todaysCompletedOrders} storeName={activeStore} singleColumn="completed" />;
    }
    
    return (
        <>
        {sortedCompletedGroupKeys.length > 0 ? (
            <div className="space-y-1">
            {visibleCompletedGroupKeys.map(key => {
                const isExpanded = expandedGroups.has(key);
                return (
                <div 
                    key={key}
                    onDragOver={(e) => handleDragOverDateGroup(e, key)}
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
                        />
                        ))}
                    </div>
                    )}
                </div>
                );
            })}
             {sortedCompletedGroupKeys.length > visibleCompletedGroupKeys.length && (
                 <button onClick={() => setShowAllCompleted(true)} className="w-full text-center text-sm text-indigo-400 hover:text-indigo-300 py-2">
                     Show more...
                 </button>
             )}
             {showAllCompleted && (
                  <button onClick={() => setShowAllCompleted(false)} className="w-full text-center text-sm text-indigo-400 hover:text-indigo-300 py-2">
                     Show less
                 </button>
             )}
            </div>
        ) : (
            <div className="text-center py-12">
            <p className="text-gray-500">No completed orders.</p>
            </div>
        )}
        </>
    );
  };

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

  // --- SMART VIEW IMPLEMENTATION ---
  
  const smartViewOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return orders.filter(order => {
        // Include any order that is not completed
        if (order.status !== OrderStatus.COMPLETED) {
            return true;
        }
        // Include completed orders only if they were completed today
        if (order.completedAt) {
            const completedDate = new Date(order.completedAt);
            completedDate.setHours(0, 0, 0, 0);
            return completedDate.getTime() === today.getTime();
        }
        return false;
    });
  }, [orders]);


  if (isSmartView) {
    // New Smart View: 3 columns, stacking on mobile
    return (
        <div className="flex-grow pt-4 h-full grid grid-cols-1 md:grid-cols-3 gap-4">
            <ManagerReportView orders={smartViewOrders} storeName={null} singleColumn="dispatch" />
            <ManagerReportView orders={smartViewOrders} storeName={null} singleColumn="on_the_way" />
            <ManagerReportView orders={smartViewOrders} storeName={null} singleColumn="completed" />
        </div>
    );
  }

  // --- REGULAR VIEW IMPLEMENTATION ---

  if (columnCount === 1) {
    return (
      <div className="flex-grow pt-4 flex flex-col">
        <nav className="-mb-px flex space-x-6 px-3">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={tab.id === OrderStatus.COMPLETED ? handleCompletedTabClick : () => dispatch({ type: 'SET_ACTIVE_STATUS', payload: tab.id })}
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
        <AddSupplierModal isOpen={isSupplierSelectModalOpen} onClose={() => { setSupplierSelectModalOpen(false); setItemForNewOrder(null); setOrderToChange(null); }} onSelect={orderToChange ? handleChangeSupplierForOrder : itemForNewOrder ? handleCreateOrderFromDrop : handleAddOrder} title={orderToChange ? "Change Supplier" : itemForNewOrder ? "Select Supplier for New Order" : "Start a New Order"} />
        <PasteItemsModal isOpen={isPasteModalOpen} onClose={() => setPasteModalOpen(false)} />
        {headerContextMenu && <ContextMenu x={headerContextMenu.x} y={headerContextMenu.y} options={getMenuOptionsForDateGroup(headerContextMenu.dateGroupKey)} onClose={() => setHeaderContextMenu(null)} />}
        <DueReportModal isOpen={isDueReportModalOpen} onClose={() => setIsDueReportModalOpen(false)} orders={ordersForDueReport} />
        <ReceiptModal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} orders={ordersForReceipt} />
      </div>
    );
  }

  const gridColsClass = columnCount === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="flex-grow pt-4 overflow-x-auto hide-scrollbar">
      <div className={`h-full grid ${gridColsClass} gap-4 min-w-[900px] xl:min-w-full`}>
        {STATUS_TABS.map((tab, index) => {
          if (columnCount === 2 && tab.id === OrderStatus.DISPATCHING) return null;
          return (
            <section
              key={tab.id}
              className={`flex flex-col bg-gray-900/50 rounded-lg transition-colors ${dragOverColumn === tab.id ? 'bg-indigo-900/50' : ''}`}
              onDragOver={(e) => {
                if (draggedOrderId) {
                    e.preventDefault();
                    setDragOverColumn(tab.id);
                }
              }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => { e.preventDefault(); handleDropOnStatus(tab.id); }}
            >
              <h2
                className={`text-lg font-semibold text-white p-3 ${tab.id === OrderStatus.COMPLETED ? 'cursor-pointer hover:text-indigo-400 transition-colors' : ''}`}
                onClick={tab.id === OrderStatus.COMPLETED ? handleCompletedTabClick : undefined}
              >
                {tab.label}
              </h2>
              <div className="flex-grow overflow-y-auto hide-scrollbar px-2 pb-2">
                <div className="grid grid-cols-1 gap-4">
                    {renderStatusContent(tab.id)}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      
      <AddSupplierModal isOpen={isSupplierSelectModalOpen} onClose={() => { setSupplierSelectModalOpen(false); setItemForNewOrder(null); setOrderToChange(null); }} onSelect={orderToChange ? handleChangeSupplierForOrder : itemForNewOrder ? handleCreateOrderFromDrop : handleAddOrder} title={orderToChange ? "Change Supplier" : itemForNewOrder ? "Select Supplier for New Order" : "Start a New Order"} />
      <PasteItemsModal isOpen={isPasteModalOpen} onClose={() => setPasteModalOpen(false)} />
      {headerContextMenu && <ContextMenu x={headerContextMenu.x} y={headerContextMenu.y} options={getMenuOptionsForDateGroup(headerContextMenu.dateGroupKey)} onClose={() => setHeaderContextMenu(null)} />}
      <DueReportModal isOpen={isDueReportModalOpen} onClose={() => setIsDueReportModalOpen(false)} orders={ordersForDueReport} />
      <ReceiptModal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} orders={ordersForReceipt} />
    </div>
  );
};

export default OrderWorkspace;