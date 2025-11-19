import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { STATUS_TABS } from '../constants';
import SupplierCard from '../components/SupplierCard';
import AddSupplierModal from './modals/AddSupplierModal';
import { Order, OrderItem, OrderStatus, Supplier, StoreName, PaymentMethod, SupplierName, Unit, ItemPrice } from '../types';
import ContextMenu from './ContextMenu';
import { useNotifier } from '../context/NotificationContext';
import { generateStoreReport, getPhnomPenhDateKey } from '../utils/messageFormatter';
import DueReportModal from './modals/DueReportModal';
import ReceiptModal from './modals/ReceiptModal';
import ManagerReportView from './ManagerReportView';
import PasteItemsModal from './modals/PasteItemsModal';

const formatDateGroupHeader = (key: string): string => {
  if (key === 'Today') return 'Today';
  
  const todayKey = getPhnomPenhDateKey();
  
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = getPhnomPenhDateKey(yesterdayDate);
  
  if (key === todayKey) return 'Today'; 
  if (key === yesterdayKey) return 'Yesterday';

  const [year, month, day] = key.split('-').map(Number);
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${String(year).slice(-2)}`;
};

const InlineAddOrder: React.FC<{ onAddSupplier: () => void, onPasteList: () => void }> = ({ onAddSupplier, onPasteList }) => {
    const { state } = useContext(AppContext);
    const { activeStore } = state;

    if (activeStore === 'Settings' || activeStore === 'ALL') { return null; }

    return (
        <div className="bg-gray-800 rounded-xl shadow-lg flex flex-col border-2 border-dashed border-gray-700 items-center justify-center p-4 min-h-[10rem] w-full max-w-sm">
            <div className="flex flex-col items-center justify-center space-y-4 w-full">
                <button onClick={onAddSupplier} className="text-indigo-400 hover:text-indigo-300 hover:bg-gray-700/50 font-semibold transition-colors text-lg py-2 px-4 rounded-lg w-full border border-indigo-500/30">
                    + Select Supplier
                </button>
                <span className="text-gray-500 text-xs">or</span>
                <button onClick={onPasteList} className="text-indigo-400 hover:text-indigo-300 hover:bg-gray-700/50 font-semibold transition-colors text-lg py-2 px-4 rounded-lg w-full border border-indigo-500/30">
                    Paste a List
                </button>
            </div>
        </div>
    );
};


const OrderWorkspace: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { activeStore, orders, suppliers, draggedOrderId, columnCount, activeStatus, draggedItem, isSmartView, itemPrices, initialAction } = state;
  const { notify } = useNotifier();

  // ... (state definitions)
  const [isSupplierSelectModalOpen, setSupplierSelectModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  
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
  
  const [mobileSmartViewPage, setMobileSmartViewPage] = useState(1); // 0: Dispatch, 1: On The Way, 2: Completed

  useEffect(() => {
      if (initialAction && activeStore !== 'Settings' && activeStore !== 'ALL') {
          if (initialAction === 'paste-list') {
              setIsPasteModalOpen(true);
          } else if (initialAction === 'add-card') {
              setSupplierSelectModalOpen(true);
          }
          dispatch({ type: 'CLEAR_INITIAL_ACTION' });
      }
  }, [initialAction, activeStore, dispatch]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = 0; 
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchEndX.current === 0) return; // No movement, likely a click
    const swipeDistance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = swipeDistance > 50;
    const isRightSwipe = swipeDistance < -50;
    
    if (isSmartView && columnCount === 1) {
        if (isLeftSwipe) {
            setMobileSmartViewPage(p => Math.min(2, p + 1));
        } else if (isRightSwipe) {
            setMobileSmartViewPage(p => Math.max(0, p - 1));
        }
    } else if (!isSmartView && columnCount === 1) {
        const currentIndex = STATUS_TABS.findIndex(tab => tab.id === activeStatus);
        if (isLeftSwipe && currentIndex < STATUS_TABS.length - 1) {
            dispatch({ type: 'SET_ACTIVE_STATUS', payload: STATUS_TABS[currentIndex + 1].id });
        } else if (isRightSwipe && currentIndex > 0) {
            dispatch({ type: 'SET_ACTIVE_STATUS', payload: STATUS_TABS[currentIndex - 1].id });
        }
    }
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
    if (activeStore === 'Settings' || activeStore === 'ALL' || !activeStore) return;
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
    if (!itemForNewOrder || activeStore === 'Settings' || activeStore === 'ALL') return;

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
    if (activeStore === 'Settings' || activeStore === 'ALL') return;

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
  
      if (activeStore === 'ALL') {
          filtered = orders.filter(order => order.status === status);
      } else if (activeStore === StoreName.KALI) {
          filtered = orders.filter(order => {
              const supplier = suppliers.find(s => s.id === order.supplierId);
              const effectivePaymentMethod = order.paymentMethod || supplier?.paymentMethod;
              return effectivePaymentMethod === PaymentMethod.KALI && order.status === status;
          });
      } else {
          filtered = orders.filter(order => order.store === activeStore && order.status === status);
      }
      
      const customSortOrder: string[] = ['KALI', 'STOCK'];
      const lastSupplier = 'PISEY';

      return filtered.sort((a, b) => {
          const nameA = a.supplierName;
          const nameB = b.supplierName;

          if (nameA === lastSupplier && nameB !== lastSupplier) return 1;
          if (nameB === lastSupplier && nameA !== lastSupplier) return -1;

          const indexA = customSortOrder.indexOf(nameA);
          const indexB = customSortOrder.indexOf(nameB);

          if (indexA > -1 && indexB > -1) return indexA - indexB;
          if (indexA > -1) return -1;
          if (indexB > -1) return 1;
          
          return nameA.localeCompare(nameB);
      });
  };
  
  const groupedCompletedOrders = useMemo(() => {
    const ordersToGroup = getFilteredOrdersForStatus(OrderStatus.COMPLETED);
    const groups: Record<string, Order[]> = {};

    const todayKey = getPhnomPenhDateKey();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = getPhnomPenhDateKey(yesterdayDate);

    // Ensure Today and Yesterday groups always exist
    groups['Today'] = [];
    groups[yesterdayKey] = [];

    ordersToGroup.forEach(order => {
        const completedDateKey = getPhnomPenhDateKey(order.completedAt);
        const key = completedDateKey === todayKey ? 'Today' : completedDateKey;
        if (!groups[key]) {
            groups[key] = [];
        }
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
    
    if (dateGroupKey === 'Today' && activeStore !== 'ALL' && activeStore !== 'Settings') {
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

    const todayKey = getPhnomPenhDateKey();
    const dateKeyToUse = key === 'Today' ? todayKey : key;

    // Create a date at noon in Phnom Penh for the target date, then get its UTC ISO string.
    const targetDate = new Date(`${dateKeyToUse}T12:00:00.000+07:00`);

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

  const DispatchingColumnContent = () => {
    const dispatchingOrders = getFilteredOrdersForStatus(OrderStatus.DISPATCHING);
    return (
      <>
        {dispatchingOrders.map(order => (
          <SupplierCard 
              key={order.id} 
              order={order} 
              onItemDrop={handleItemDropOnCard}
              showStoreName={activeStore === StoreName.KALI || activeStore === 'ALL'}
          />
        ))}
        <InlineAddOrder onAddSupplier={() => setSupplierSelectModalOpen(true)} onPasteList={() => setIsPasteModalOpen(true)} />
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
              showStoreName={activeStore === StoreName.KALI || activeStore === 'ALL'}
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
    if (completedViewMode === 'report' && (activeStore !== 'Settings' && activeStore !== 'ALL')) {
        const todaysCompletedOrders = groupedCompletedOrders['Today'] || [];
        return <ManagerReportView orders={todaysCompletedOrders} onItemDrop={handleItemDropOnCard} singleColumn="completed" />;
    }
    
    return (
        <>
        {sortedCompletedGroupKeys.length > 0 ? (
            <div className="space-y-1">
            {visibleCompletedGroupKeys.map(key => {
                const isExpanded = expandedGroups.has(key);
                const ordersInGroup = groupedCompletedOrders[key] || [];
                return (
                <div 
                    key={key}
                    onDragOver={(e) => handleDragOverDateGroup(e, key)}
                    onDragLeave={() => setDragOverDateGroup(null)}
                    onDrop={(e) => { e.preventDefault(); handleDropOnDateGroup(key); }}
                    className="w-full max-w-sm"
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
                        {ordersInGroup.length > 0 ? ordersInGroup.map((order) => (
                        <SupplierCard 
                            key={order.id} 
                            order={order}
                            onItemDrop={handleItemDropOnCard}
                            showStoreName={activeStore === StoreName.KALI || activeStore === 'ALL'} 
                        />
                        )) : (
                            <div className="text-center text-gray-500 text-sm py-4 px-2">
                                No completed orders for this day.
                            </div>
                        )}
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
  
  const smartViewOrders = useMemo(() => {
    const todayKey = getPhnomPenhDateKey();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = getPhnomPenhDateKey(yesterdayDate);

    return orders.filter(order => {
        if (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY) {
            return true;
        }
        if (order.status === OrderStatus.COMPLETED && order.completedAt) {
            const completedDateKey = getPhnomPenhDateKey(order.completedAt);
            return completedDateKey === todayKey || completedDateKey === yesterdayKey;
        }
        return false;
    });
  }, [orders]);


  if (isSmartView) {
      if (columnCount === 1) { // Mobile Portrait Smart View
        const isDragging = !!draggedOrderId || !!draggedItem;
        return (
            <div 
                className="flex-grow flex flex-col overflow-hidden pt-2"
                onTouchStart={handleTouchStart} 
                onTouchMove={handleTouchMove} 
                onTouchEnd={handleTouchEnd}
            >
                 {isDragging && (
                    <>
                        <div 
                            className="fixed top-0 left-0 h-full w-[15vw] z-20"
                            onDragEnter={() => setMobileSmartViewPage(p => Math.max(0, p - 1))}
                        />
                        <div 
                            className="fixed top-0 right-0 h-full w-[15vw] z-20"
                            onDragEnter={() => setMobileSmartViewPage(p => Math.min(2, p + 1))}
                        />
                    </>
                )}
                {/* Swipeable content */}
                <div className="flex-grow flex transition-transform duration-300 ease-in-out" style={{ transform: `translateX(-${mobileSmartViewPage * 100}%)` }}>
                    {STATUS_TABS.map(tab => (
                        <div key={tab.id} className="w-full flex-shrink-0 px-1 flex flex-col">
                            <div 
                                onDragOver={(e) => { if (draggedOrderId) { e.preventDefault(); setDragOverColumn(tab.id); }}}
                                onDragLeave={() => setDragOverColumn(null)}
                                onDrop={(e) => { e.preventDefault(); handleDropOnStatus(tab.id); }}
                                className={`flex-grow rounded-lg transition-colors duration-200 overflow-y-auto hide-scrollbar ${dragOverColumn === tab.id ? 'bg-indigo-900/20' : ''}`}
                            >
                                <ManagerReportView 
                                    orders={smartViewOrders} 
                                    singleColumn={tab.id === OrderStatus.DISPATCHING ? 'dispatch' : tab.id}
                                    onItemDrop={handleItemDropOnCard}
                                    hideTitle={false} // Show titles like "Dispatch" inside the column
                                    showStoreName={activeStore === 'ALL'}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    // Desktop / Landscape Smart View
    return (
        <div className="flex-grow pt-4 h-full grid grid-cols-1 md:grid-cols-3 gap-10">
            <div 
                onDragOver={(e) => { if (draggedOrderId) { e.preventDefault(); setDragOverColumn(OrderStatus.DISPATCHING); }}}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => { e.preventDefault(); handleDropOnStatus(OrderStatus.DISPATCHING); }}
                className={`rounded-lg transition-colors duration-200 ${dragOverColumn === OrderStatus.DISPATCHING ? 'bg-indigo-900/20' : ''}`}
            >
                <ManagerReportView 
                    orders={smartViewOrders} 
                    singleColumn="dispatch"
                    onItemDrop={handleItemDropOnCard}
                    showStoreName={activeStore === 'ALL'}
                />
            </div>
             <div 
                onDragOver={(e) => { if (draggedOrderId) { e.preventDefault(); setDragOverColumn(OrderStatus.ON_THE_WAY); }}}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => { e.preventDefault(); handleDropOnStatus(OrderStatus.ON_THE_WAY); }}
                className={`rounded-lg transition-colors duration-200 ${dragOverColumn === OrderStatus.ON_THE_WAY ? 'bg-indigo-900/20' : ''}`}
            >
                <ManagerReportView 
                    orders={smartViewOrders} 
                    singleColumn="on_the_way"
                    onItemDrop={handleItemDropOnCard}
                    showStoreName={activeStore === 'ALL'}
                />
            </div>
             <div 
                onDragOver={(e) => { if (draggedOrderId) { e.preventDefault(); setDragOverColumn(OrderStatus.COMPLETED); }}}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => { e.preventDefault(); handleDropOnStatus(OrderStatus.COMPLETED); }}
                className={`rounded-lg transition-colors duration-200 w-full max-w-sm ${dragOverColumn === OrderStatus.COMPLETED ? 'bg-indigo-900/20' : ''}`}
            >
                <ManagerReportView 
                    orders={smartViewOrders} 
                    singleColumn="completed"
                    onItemDrop={handleItemDropOnCard}
                    showStoreName={activeStore === 'ALL'}
                />
            </div>
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
              className={`whitespace-nowrap py-3 px-2 md:px-4 border-b-2 font-medium text-sm transition-colors ${
                activeStatus === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
              } ${
                dragOverStatusTab === tab.id ? 'bg-indigo-900/50' : ''
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div
          className="flex-grow overflow-y-auto pt-4 space-y-4 hide-scrollbar px-1"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {activeStore === 'ALL' && <div className="text-center py-4 text-gray-500 text-sm">Select a store to create or paste orders.</div>}
          {renderStatusContent(activeStatus)}
        </div>
      </div>
    );
  }

  // Multi-column view
  return (
    <>
      <div className={`flex-grow pt-4 grid gap-4 grid-cols-1 md:grid-cols-3`}>
        {STATUS_TABS.map(tab => (
            <div 
              key={tab.id} 
              className={`flex-grow flex flex-col space-y-4 p-2 rounded-lg transition-colors duration-200 ${dragOverColumn === tab.id ? 'bg-indigo-900/20' : ''}`}
              onDragOver={(e) => { if (draggedOrderId) { e.preventDefault(); setDragOverColumn(tab.id); }}}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => { e.preventDefault(); handleDropOnStatus(tab.id); }}
            >
                <h2 className="text-lg font-semibold text-white px-1 cursor-pointer" onClick={tab.id === OrderStatus.COMPLETED ? handleCompletedTabClick : undefined}>
                    {tab.label}{activeStore === 'ALL' && ` (${getFilteredOrdersForStatus(tab.id).length})`}
                </h2>
                <div className="flex-grow overflow-y-auto space-y-4 hide-scrollbar pr-2 -mr-2">
                    {activeStore === 'ALL' && tab.id === OrderStatus.DISPATCHING && <div className="text-center py-4 text-gray-500 text-sm">Select a store to create or paste orders.</div>}
                    {renderStatusContent(tab.id)}
                </div>
            </div>
        ))}
      </div>
      
      <AddSupplierModal
        isOpen={isSupplierSelectModalOpen}
        onClose={() => {
          setSupplierSelectModalOpen(false);
          setItemForNewOrder(null);
          setOrderToChange(null);
        }}
        onSelect={itemForNewOrder ? handleCreateOrderFromDrop : (orderToChange ? handleChangeSupplierForOrder : handleAddOrder)}
        title={itemForNewOrder ? "Create New Order For..." : (orderToChange ? "Change Supplier To..." : "Select Supplier")}
      />
      <PasteItemsModal isOpen={isPasteModalOpen} onClose={() => setIsPasteModalOpen(false)} />
      {headerContextMenu && <ContextMenu x={headerContextMenu.x} y={headerContextMenu.y} options={getMenuOptionsForDateGroup(headerContextMenu.dateGroupKey)} onClose={() => setHeaderContextMenu(null)} />}
      <DueReportModal isOpen={isDueReportModalOpen} onClose={() => setIsDueReportModalOpen(false)} orders={ordersForDueReport} />
      <ReceiptModal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} orders={ordersForReceipt} />
    </>
  );
};

export default OrderWorkspace;