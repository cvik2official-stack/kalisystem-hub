import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { STATUS_TABS } from '../constants';
import SupplierCard from '../components/SupplierCard';
import AddSupplierModal from './modals/AddSupplierModal';
import { Order, OrderItem, OrderStatus, Supplier, StoreName, PaymentMethod, SupplierName, Unit, ItemPrice, QuickOrder, Item } from '../types';
import ContextMenu from './ContextMenu';
import { useNotifier } from '../context/NotificationContext';
import { generateStoreReport, getPhnomPenhDateKey } from '../utils/messageFormatter';
import PasteItemsModal from './modals/PasteItemsModal';
import AddItemModal from './modals/AddItemModal';

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

const InlineAddOrder: React.FC<{ 
    onAddSupplier: () => void, 
    onPasteList: () => void,
    onSelectItem: () => void,
    onQuickOrder: (qo: QuickOrder) => void
}> = ({ onAddSupplier, onPasteList, onSelectItem, onQuickOrder }) => {
    const { state } = useContext(AppContext);
    const { activeStore, quickOrders } = state;

    if (activeStore === 'Settings' || activeStore === 'ALL') { return null; }

    const storeQuickOrders = quickOrders.filter(qo => qo.store === activeStore);

    return (
        <div className="bg-gray-800 rounded-xl shadow-lg flex flex-col border-2 border-dashed border-gray-700 items-center justify-center p-4 w-full max-w-sm mx-auto my-4 transition-all hover:border-gray-600">
            <div className="flex flex-col space-y-3 w-full">
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={onAddSupplier} className="flex items-center justify-center text-indigo-400 hover:text-white hover:bg-indigo-600 font-semibold transition-all text-sm py-3 px-2 rounded-lg border border-indigo-500/30 hover:border-indigo-500 shadow-sm">
                        <span className="mr-1 text-lg">+</span> Supplier
                    </button>
                    <button onClick={onSelectItem} className="flex items-center justify-center text-indigo-400 hover:text-white hover:bg-indigo-600 font-semibold transition-all text-sm py-3 px-2 rounded-lg border border-indigo-500/30 hover:border-indigo-500 shadow-sm">
                        <span className="mr-1 text-lg">+</span> Item
                    </button>
                </div>
                
                <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-gray-700"></div>
                    <span className="flex-shrink-0 mx-2 text-gray-600 text-[10px] font-bold uppercase tracking-widest">OR</span>
                    <div className="flex-grow border-t border-gray-700"></div>
                </div>

                <button onClick={onPasteList} className="text-gray-400 hover:text-white hover:bg-gray-700 font-medium transition-colors text-sm py-2 px-4 rounded-lg w-full border border-gray-600 hover:border-gray-500">
                    Paste a List
                </button>

                {storeQuickOrders.length > 0 && (
                    <div className="pt-2">
                        <div className="flex items-center mb-2">
                             <div className="h-px bg-gray-700 flex-grow"></div>
                             <span className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Quick Orders</span>
                             <div className="h-px bg-gray-700 flex-grow"></div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {storeQuickOrders.map(qo => (
                                <button key={qo.id} onClick={() => onQuickOrder(qo)} className="bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white text-xs py-2 px-3 rounded border border-gray-700 hover:border-gray-500 transition-all flex items-center justify-between group">
                                    <span className="font-medium truncate">{qo.name}</span>
                                    <span className="text-[10px] text-gray-500 group-hover:text-gray-400">{qo.supplierName}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


const OrderWorkspace: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { activeStore, orders, suppliers, draggedOrderId, columnCount, activeStatus, draggedItem, itemPrices, initialAction } = state;
  const { notify } = useNotifier();

  const [isSupplierSelectModalOpen, setSupplierSelectModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isStandaloneItemModalOpen, setIsStandaloneItemModalOpen] = useState(false);
  
  const [itemForNewOrder, setItemForNewOrder] = useState<{ item: OrderItem; sourceOrderId: string } | null>(null);
  const [orderToChange, setOrderToChange] = useState<Order | null>(null);
  const [isDragOverEmpty, setIsDragOverEmpty] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Today', 'Yesterday']));
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  const [headerContextMenu, setHeaderContextMenu] = useState<{ x: number, y: number, dateGroupKey: string } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<OrderStatus | null>(null);
  const [dragOverStatusTab, setDragOverStatusTab] = useState<OrderStatus | null>(null);
  const [dragOverDateGroup, setDragOverDateGroup] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  
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
    
    if (columnCount === 1) {
        const currentIndex = STATUS_TABS.findIndex(tab => tab.id === activeStatus);
        if (isLeftSwipe && currentIndex < STATUS_TABS.length - 1) {
            dispatch({ type: 'SET_ACTIVE_STATUS', payload: STATUS_TABS[currentIndex + 1].id });
        } else if (isRightSwipe && currentIndex > 0) {
            dispatch({ type: 'SET_ACTIVE_STATUS', payload: STATUS_TABS[currentIndex - 1].id });
        }
    }
  };
  
  const handleCompletedTabClick = (e: React.MouseEvent) => {
    if (activeStatus !== OrderStatus.COMPLETED) {
        dispatch({ type: 'SET_ACTIVE_STATUS', payload: OrderStatus.COMPLETED });
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
  
  const handleGenerateStoreReport = () => {
    if (activeStore === 'Settings' || activeStore === 'ALL') return;

    const todayKey = getPhnomPenhDateKey();

    // Use the filter function to ensure we see what the user sees (handles KALI view logic correctly)
    const relevantOrders = getFilteredOrdersForStatus(OrderStatus.COMPLETED);

    const todaysCompletedOrders = relevantOrders.filter(o => {
      return o.completedAt && getPhnomPenhDateKey(o.completedAt) === todayKey;
    });
    
    if (todaysCompletedOrders.length === 0) {
        notify("No completed orders for today to generate a report.", 'info');
        return;
    }
    
    let reportText = generateStoreReport(todaysCompletedOrders);
    
    if (activeStore === StoreName.KALI) {
        const lines = reportText.split('\n');
        if (lines.length > 0) {
            lines[0] = `*KALI Delivery Report - ${new Date().toLocaleDateString('en-GB')}*`;
            reportText = lines.join('\n');
        }
    }

    navigator.clipboard.writeText(reportText).then(() => {
        notify('Store report copied to clipboard!', 'success');
    }).catch(err => {
        notify(`Failed to copy report: ${err}`, 'error');
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
  
  const getMenuOptionsForDateGroup = (dateGroupKey: string) => {
    const options = [];
    
    if (dateGroupKey === 'Today' && activeStore !== 'ALL' && activeStore !== 'Settings') {
        options.push(
            { label: 'New Card...', action: () => setSupplierSelectModalOpen(true) },
            { label: 'Store Report', action: handleGenerateStoreReport }
        );
    }
    return options;
  };

  const handleDropOnDateGroup = (key: string) => {
    if (!draggedOrderId) return;
    const orderToMove = orders.find(o => o.id === draggedOrderId);
    if (!orderToMove) return;

    const todayKey = getPhnomPenhDateKey();
    
    // If "Today" is dropped on, use today's key. 
    // Otherwise, key IS the YYYY-MM-DD string for that group (e.g. Yesterday's actual date key).
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

  const handleStandaloneItemSelect = async (item: Item) => {
      if (activeStore === 'Settings' || activeStore === 'ALL') return;
      
      await actions.addItemToDispatch(item);
      setIsStandaloneItemModalOpen(false);
  };

  const handleQuickOrder = async (qo: QuickOrder) => {
      const supplier = suppliers.find(s => s.id === qo.supplierId);
      if (!supplier) {
          notify('Supplier not found for this Quick Order', 'error');
          return;
      }
      await actions.addOrder(supplier, qo.store, qo.items, OrderStatus.DISPATCHING);
      notify(`Quick Order "${qo.name}" added to Dispatch.`, 'success');
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
        <InlineAddOrder 
            onAddSupplier={() => setSupplierSelectModalOpen(true)} 
            onPasteList={() => setIsPasteModalOpen(true)} 
            onSelectItem={() => setIsStandaloneItemModalOpen(true)}
            onQuickOrder={handleQuickOrder}
        />
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
        {onTheWayOrders.length === 0 && activeStore !== 'Settings' && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <p className="text-sm font-medium">No orders on the way.</p>
            </div>
        )}
      </>
    );
  };

  const CompletedColumnContent = () => {
    return (
      <>
        {visibleCompletedGroupKeys.map(key => {
          const ordersInDateGroup = groupedCompletedOrders[key] || [];
          const isExpanded = expandedGroups.has(key);
          const isDragOver = dragOverDateGroup === key;
          
          // Sort orders within date group by store then supplier (same logic as before)
          const sortedOrdersInGroup = [...ordersInDateGroup].sort((a, b) => {
              const storeCompare = a.store.localeCompare(b.store);
              if (storeCompare !== 0) return storeCompare;
              
              const nameA = a.supplierName;
              const nameB = b.supplierName;
              if (nameA === 'PISEY' && nameB !== 'PISEY') return 1;
              if (nameB === 'PISEY' && nameA !== 'PISEY') return -1;
              const indexA = ['KALI', 'STOCK'].indexOf(nameA);
              const indexB = ['KALI', 'STOCK'].indexOf(nameB);
              if (indexA > -1 && indexB > -1) return indexA - indexB;
              if (indexA > -1) return -1;
              if (indexB > -1) return 1;
              return nameA.localeCompare(nameB);
          });

          return (
            <div 
                key={key} 
                className={`mb-4 transition-colors ${isDragOver ? 'bg-green-900/20 rounded-lg p-1 -m-1' : ''}`}
                onDragOver={(e) => handleDragOverDateGroup(e, key)}
                onDragLeave={() => setDragOverDateGroup(null)}
                onDrop={() => handleDropOnDateGroup(key)}
            >
              <div 
                className="flex items-center justify-between cursor-pointer p-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                onClick={() => toggleGroup(key)}
              >
                <div className="flex items-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <h3 className="text-sm font-bold text-white">{formatDateGroupHeader(key)}</h3>
                    <span className="text-xs text-gray-500 bg-gray-900 px-2 py-0.5 rounded-full">{sortedOrdersInGroup.length}</span>
                </div>
                <div className="flex items-center space-x-2">
                    {key === 'Today' && activeStore !== 'ALL' && activeStore !== 'Settings' && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleGenerateStoreReport(); }} 
                            className="text-xs text-gray-400 hover:text-indigo-400 font-medium p-1 hover:bg-gray-700 rounded"
                            title="Copy Store Report"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        </button>
                    )}
                </div>
              </div>
              
              {isExpanded && (
                <div className="mt-2 space-y-2 pl-2">
                  {sortedOrdersInGroup.length > 0 ? (
                    sortedOrdersInGroup.map(order => (
                      <SupplierCard 
                          key={order.id} 
                          order={order} 
                          onItemDrop={handleItemDropOnCard}
                          showStoreName={activeStore === StoreName.KALI || activeStore === 'ALL'}
                      />
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 italic ml-6">No orders.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {sortedCompletedGroupKeys.length > visibleCompletedGroupKeys.length && (
            <button 
                onClick={() => setShowAllCompleted(!showAllCompleted)}
                className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 font-medium text-center"
            >
                {showAllCompleted ? 'Show Less' : 'Show more...'}
            </button>
        )}
      </>
    );
  };

  if (columnCount === 1) {
      // Mobile/Single Column Layout
      const renderCurrentTab = () => {
          switch (activeStatus) {
              case OrderStatus.DISPATCHING: return <DispatchingColumnContent />;
              case OrderStatus.ON_THE_WAY: return <OnTheWayColumnContent />;
              case OrderStatus.COMPLETED: return <CompletedColumnContent />;
              default: return null;
          }
      };

      return (
          <div 
            className="flex-grow flex flex-col relative overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
              {/* Mobile Tabs */}
              <div className="flex border-b border-gray-700 mb-2">
                  {STATUS_TABS.map(tab => (
                      <button
                          key={tab.id}
                          onClick={() => dispatch({ type: 'SET_ACTIVE_STATUS', payload: tab.id })}
                          onDragOver={(e) => { e.preventDefault(); setDragOverStatusTab(tab.id); }}
                          onDragLeave={() => setDragOverStatusTab(null)}
                          onDrop={() => handleDropOnStatus(tab.id)}
                          className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                              activeStatus === tab.id ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                          } ${dragOverStatusTab === tab.id ? 'bg-indigo-900/30' : ''}`}
                      >
                          {tab.label}
                          {activeStatus === tab.id && (
                              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500"></span>
                          )}
                      </button>
                  ))}
              </div>
              
              <div className="flex-grow overflow-y-auto px-2 pb-20 hide-scrollbar">
                  {renderCurrentTab()}
              </div>
              
              <AddSupplierModal 
                  isOpen={isSupplierSelectModalOpen} 
                  onClose={() => setSupplierSelectModalOpen(false)} 
                  onSelect={draggedItem ? handleCreateOrderFromDrop : (orderToChange ? handleChangeSupplierForOrder : handleAddOrder)}
                  title={draggedItem ? "Create new order from item..." : (orderToChange ? "Change Supplier To..." : "Add Supplier Card")}
              />
              <AddItemModal 
                  isOpen={isStandaloneItemModalOpen} 
                  onClose={() => setIsStandaloneItemModalOpen(false)} 
                  onItemSelect={handleStandaloneItemSelect}
                  order={null}
              />
              <PasteItemsModal isOpen={isPasteModalOpen} onClose={() => setIsPasteModalOpen(false)} />
          </div>
      );
  }

  return (
    <div className="flex-grow flex overflow-hidden h-full space-x-4">
      {/* Desktop/Tablet 3-Column Layout */}
      <div 
        className={`flex-1 flex flex-col min-w-0 bg-gray-900/50 rounded-xl border ${dragOverColumn === OrderStatus.DISPATCHING ? 'border-indigo-500 bg-indigo-900/10' : 'border-transparent'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOverColumn(OrderStatus.DISPATCHING); }}
        onDragLeave={() => setDragOverColumn(null)}
        onDrop={() => handleDropOnStatus(OrderStatus.DISPATCHING)}
      >
        <h2 className="text-lg font-bold text-white mb-4 px-2 sticky top-0 bg-gray-900 z-10 py-2">Dispatch</h2>
        <div className="flex-grow overflow-y-auto px-2 pb-20 hide-scrollbar space-y-3">
            <DispatchingColumnContent />
        </div>
      </div>

      <div 
        className={`flex-1 flex flex-col min-w-0 bg-gray-900/50 rounded-xl border ${dragOverColumn === OrderStatus.ON_THE_WAY ? 'border-indigo-500 bg-indigo-900/10' : 'border-transparent'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOverColumn(OrderStatus.ON_THE_WAY); }}
        onDragLeave={() => setDragOverColumn(null)}
        onDrop={() => handleDropOnStatus(OrderStatus.ON_THE_WAY)}
      >
        <h2 className="text-lg font-bold text-white mb-4 px-2 sticky top-0 bg-gray-900 z-10 py-2">On the Way</h2>
        <div className="flex-grow overflow-y-auto px-2 pb-20 hide-scrollbar space-y-3">
            <OnTheWayColumnContent />
        </div>
      </div>

      <div 
        className={`flex-1 flex flex-col min-w-0 bg-gray-900/50 rounded-xl border ${dragOverColumn === OrderStatus.COMPLETED ? 'border-indigo-500 bg-indigo-900/10' : 'border-transparent'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOverColumn(OrderStatus.COMPLETED); }}
        onDragLeave={() => setDragOverColumn(null)}
        onDrop={() => handleDropOnStatus(OrderStatus.COMPLETED)}
      >
        <h2 className="text-lg font-bold text-white mb-4 px-2 sticky top-0 bg-gray-900 z-10 py-2">Completed</h2>
        <div className="flex-grow overflow-y-auto px-2 pb-20 hide-scrollbar">
            <CompletedColumnContent />
        </div>
      </div>

      <AddSupplierModal 
          isOpen={isSupplierSelectModalOpen} 
          onClose={() => setSupplierSelectModalOpen(false)} 
          onSelect={draggedItem ? handleCreateOrderFromDrop : (orderToChange ? handleChangeSupplierForOrder : handleAddOrder)}
          title={draggedItem ? "Create new order from item..." : (orderToChange ? "Change Supplier To..." : "Add Supplier Card")}
      />
      <AddItemModal 
          isOpen={isStandaloneItemModalOpen} 
          onClose={() => setIsStandaloneItemModalOpen(false)} 
          onItemSelect={handleStandaloneItemSelect}
          order={null}
      />
      <PasteItemsModal isOpen={isPasteModalOpen} onClose={() => setIsPasteModalOpen(false)} />
      {headerContextMenu && (
          <ContextMenu
              x={headerContextMenu.x}
              y={headerContextMenu.y}
              options={getMenuOptionsForDateGroup(headerContextMenu.dateGroupKey)}
              onClose={() => setHeaderContextMenu(null)}
          />
      )}
    </div>
  );
};

export default OrderWorkspace;