import React, { useContext, useMemo, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { STATUS_TABS } from '../constants';
import SupplierCard from './SupplierCard';
import AddSupplierModal from './modals/AddSupplierModal';
import { Order, OrderItem, OrderStatus, Supplier, StoreName, PaymentMethod, SupplierName } from '../types';
import PasteItemsModal from './modals/PasteItemsModal';
import ContextMenu from './ContextMenu';
import MergeByPaymentModal from './modals/MergeByPaymentModal';
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
  const { activeStore, activeStatus, orders, suppliers, isEditModeEnabled, columnCount } = state;
  const { notify } = useNotifier();

  const [isAddSupplierModalOpen, setAddSupplierModalOpen] = useState(false);
  const [isPasteModalOpen, setPasteModalOpen] = useState(false);
  
  const [draggedItem, setDraggedItem] = useState<{ item: OrderItem; sourceOrderId: string } | null>(null);
  const [itemForNewOrder, setItemForNewOrder] = useState<{ item: OrderItem; sourceOrderId: string } | null>(null);
  const [isDragOverEmpty, setIsDragOverEmpty] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState(new Set<string>(['Today']));
  const [headerContextMenu, setHeaderContextMenu] = useState<{ x: number, y: number, dateGroupKey: string } | null>(null);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isDueReportModalOpen, setIsDueReportModalOpen] = useState(false);
  const [ordersForDueReport, setOrdersForDueReport] = useState<Order[]>([]);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [ordersForReceipt, setOrdersForReceipt] = useState<Order[]>([]);


  const handleStatusChange = (status: OrderStatus) => {
    dispatch({ type: 'SET_ACTIVE_STATUS', payload: status });
  };

  const handleAddOrder = async (supplier: Supplier) => {
    if (activeStore === 'Settings' || !activeStore) return;
    const status = columnCount > 1 ? OrderStatus.DISPATCHING : (activeStatus === OrderStatus.COMPLETED ? OrderStatus.COMPLETED : OrderStatus.DISPATCHING);
    await actions.addOrder(supplier, activeStore, [], status);
    setAddSupplierModalOpen(false);
  };
  
  const handleItemDrop = async (destinationOrderId: string) => {
    if (!draggedItem) return;

    const sourceOrder = orders.find(o => o.id === draggedItem.sourceOrderId);
    const destinationOrder = orders.find(o => o.id === destinationOrderId);
    
    const canDrop = sourceOrder && 
                    destinationOrder && 
                    sourceOrder.id !== destinationOrder.id &&
                    sourceOrder.status === destinationOrder.status &&
                    (destinationOrder.status === OrderStatus.DISPATCHING || destinationOrder.status === OrderStatus.ON_THE_WAY || (destinationOrder.status === OrderStatus.COMPLETED && isEditModeEnabled));

    if (canDrop) {
        // Correctly filter out the specific dragged item, respecting its spoiled status.
        // This prevents accidentally removing both spoiled and non-spoiled versions of an item.
        const newSourceItems = sourceOrder.items.filter(i => 
            !(i.itemId === draggedItem.item.itemId && i.isSpoiled === draggedItem.item.isSpoiled)
        );
        
        const isUpdateToSentOrder = destinationOrder.status === OrderStatus.ON_THE_WAY;
        const itemToDrop = { ...draggedItem.item, isNew: isUpdateToSentOrder };

        // Find if an item with the same ID and spoiled status already exists in the destination.
        const existingItemInDestIndex = destinationOrder.items.findIndex(i => 
            i.itemId === itemToDrop.itemId && i.isSpoiled === itemToDrop.isSpoiled
        );

        let newDestinationItems;
        if (existingItemInDestIndex > -1) {
            // If it exists, update its quantity.
            newDestinationItems = [...destinationOrder.items];
            const existingItem = newDestinationItems[existingItemInDestIndex];
            newDestinationItems[existingItemInDestIndex] = {
                ...existingItem,
                quantity: existingItem.quantity + itemToDrop.quantity,
                isNew: isUpdateToSentOrder || existingItem.isNew,
            };
        } else {
            // If it's new to this order, add it to the list.
            newDestinationItems = [...destinationOrder.items, itemToDrop];
        }

        try {
            // If moving the item makes the source order empty, delete the source order
            // to prevent empty cards from cluttering the UI (unless it's a new dispatch order).
            if (newSourceItems.length === 0 && sourceOrder.status !== OrderStatus.DISPATCHING) {
                await Promise.all([
                    actions.deleteOrder(sourceOrder.id),
                    actions.updateOrder({ ...destinationOrder, items: newDestinationItems })
                ]);
            } else {
                 await Promise.all([
                    actions.updateOrder({ ...sourceOrder, items: newSourceItems }),
                    actions.updateOrder({ ...destinationOrder, items: newDestinationItems })
                ]);
            }
        } catch (error) {
            console.error("Failed to move item between orders:", error);
        }
    }
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

  const filteredOrders = useMemo(() => {
    return getFilteredOrdersForStatus(activeStatus);
  }, [orders, activeStore, activeStatus, suppliers]);
  
  const groupedCompletedOrders = useMemo(() => {
    const ordersToGroup = columnCount > 1 ? getFilteredOrdersForStatus(OrderStatus.COMPLETED) : filteredOrders;
    if ((columnCount === 1 && activeStatus !== OrderStatus.COMPLETED) || ordersToGroup.length === 0) return {};
    
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
  }, [filteredOrders, activeStatus, columnCount, orders, activeStore]);

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
            { label: 'Merge KALI...', action: () => (actions as any).mergeKaliOrders() },
            { label: 'Merge PISEY...', action: () => (actions as any).mergePiseyOrders() },
            { label: 'Merge by Payment...', action: () => setIsMergeModalOpen(true) },
            { label: 'New Card...', action: () => setAddSupplierModalOpen(true) },
            { label: 'Store Report', action: handleGenerateStoreReport }
        );
    }
    
    options.push({ label: 'Due Report...', action: () => handleGenerateDueReportForGroup(dateGroupKey) });
    options.push({ label: 'Receipt...', action: () => handleGenerateReceiptForGroup(dateGroupKey) });

    return options;
  };
  
  const renderCompletedColumn = () => (
    <>
      {sortedCompletedGroupKeys.length > 0 ? (
        <div className="space-y-1">
          {sortedCompletedGroupKeys.map(key => {
            const isExpanded = expandedGroups.has(key);
            return (
              <div key={key}>
                <div className="bg-gray-800/50 px-2 py-2 flex justify-between items-center w-full text-left rounded-md">
                  <button onClick={() => toggleGroup(key)} className="flex items-center space-x-2 flex-grow">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-400 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <h3 className="font-semibold text-white">{formatDateGroupHeader(key)}</h3>
                  </button>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setHeaderContextMenu({ x: rect.left, y: rect.bottom + 5, dateGroupKey: key }); }} className="p-1 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white" aria-label="Date Group Actions">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                  </button>
                </div>
                {isExpanded && (
                  <div className="grid grid-cols-1 gap-2 p-1">
                    {groupedCompletedOrders[key].map((order) => (
                      <SupplierCard 
                          key={order.id} 
                          order={order}
                          draggedItem={draggedItem}
                          setDraggedItem={setDraggedItem}
                          onItemDrop={handleItemDrop}
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

  const AddOrderDropZone = () => (
    <div
      className={`bg-gray-800 rounded-xl shadow-lg flex flex-col border-2 border-dashed items-center justify-center p-4 min-h-[10rem] transition-colors duration-200 mx-auto max-w-md w-full
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
        setDraggedItem(null);
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
  
  if (columnCount > 1) {
    const dispatchingOrders = getFilteredOrdersForStatus(OrderStatus.DISPATCHING);
    const onTheWayOrders = getFilteredOrdersForStatus(OrderStatus.ON_THE_WAY);
    const columnClass = columnCount === 2 ? 'grid-cols-2' : 'grid-cols-3';
    // Min width calculation: (column width + gap) * num columns. e.g. (320px + 16px) * 3 = 1008px
    const minWidthClass = columnCount === 2 ? 'min-w-[672px]' : 'min-w-[1008px]';
    
    return (
      <div className="flex-grow pt-4 overflow-x-auto hide-scrollbar">
        <div className={`h-full grid ${columnClass} ${minWidthClass} gap-4`}>
          {/* Column 1: Dispatch */}
          <section className="flex flex-col bg-gray-900/50 rounded-lg">
            <h2 className="text-lg font-semibold text-white p-3">Dispatch</h2>
            <div className="flex-grow overflow-y-auto hide-scrollbar space-y-4 px-2 pb-2">
              {dispatchingOrders.map(order => (
                <SupplierCard 
                    key={order.id} 
                    order={order} 
                    draggedItem={draggedItem}
                    setDraggedItem={setDraggedItem}
                    onItemDrop={handleItemDrop}
                    showStoreName={activeStore === StoreName.KALI}
                />
              ))}
              <AddOrderDropZone />
            </div>
          </section>

          {/* Column 2: On the Way */}
          <section className="flex flex-col bg-gray-900/50 rounded-lg">
            <h2 className="text-lg font-semibold text-white p-3">On the Way</h2>
            <div className="flex-grow overflow-y-auto hide-scrollbar space-y-4 px-2 pb-2">
              {onTheWayOrders.map(order => (
                <SupplierCard 
                    key={order.id} 
                    order={order} 
                    draggedItem={draggedItem}
                    setDraggedItem={setDraggedItem}
                    onItemDrop={handleItemDrop}
                    showStoreName={activeStore === StoreName.KALI}
                />
              ))}
               {onTheWayOrders.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No orders on the way.</p>
                  </div>
              )}
            </div>
          </section>

          {/* Column 3: Completed */}
          {columnCount === 3 && (
            <section className="flex flex-col bg-gray-900/50 rounded-lg">
              <h2 className="text-lg font-semibold text-white p-3">Completed</h2>
              <div className="flex-grow overflow-y-auto hide-scrollbar px-2 pb-2">
                {renderCompletedColumn()}
              </div>
            </section>
          )}
        </div>
        
        {/* Render modals at the end */}
        <AddSupplierModal isOpen={isAddSupplierModalOpen} onClose={() => { setAddSupplierModalOpen(false); setItemForNewOrder(null); }} onSelect={itemForNewOrder ? handleCreateOrderFromDrop : handleAddOrder} title={itemForNewOrder ? "Select Supplier for New Order" : "Start a New Order"} />
        <PasteItemsModal isOpen={isPasteModalOpen} onClose={() => setPasteModalOpen(false)} />
        {headerContextMenu && <ContextMenu x={headerContextMenu.x} y={headerContextMenu.y} options={getMenuOptionsForDateGroup(headerContextMenu.dateGroupKey)} onClose={() => setHeaderContextMenu(null)} />}
        <MergeByPaymentModal isOpen={isMergeModalOpen} onClose={() => setIsMergeModalOpen(false)} onSelect={(method) => { if (window.confirm(`Are you sure you want to merge all of today's completed orders for ${method.toUpperCase()}? This action cannot be undone.`)) { actions.mergeTodaysCompletedOrdersByPayment(method); } }} />
        <DueReportModal isOpen={isDueReportModalOpen} onClose={() => setIsDueReportModalOpen(false)} orders={ordersForDueReport} />
        <ReceiptModal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} orders={ordersForReceipt} />
      </div>
    );
  } else {
    // --- Fallback to original tabbed view for single column view ---
    const tabsToShow = STATUS_TABS;
    return (
      <>
        <div className="mt-2">
          <nav className="-mb-px flex space-x-6">
            {tabsToShow.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleStatusChange(tab.id)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
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
        
        <div className="flex-grow pt-2 pb-4 overflow-y-auto hide-scrollbar relative transition-all duration-200">
            {filteredOrders.length === 0 && activeStatus !== OrderStatus.DISPATCHING && (
                <div className="text-center py-12">
                    <p className="text-gray-500">No orders in this category.</p>
                </div>
            )}

            {activeStatus === OrderStatus.COMPLETED ? (
                renderCompletedColumn()
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                {filteredOrders.map((order) => (
                    <SupplierCard 
                        key={order.id} 
                        order={order} 
                        draggedItem={draggedItem}
                        setDraggedItem={setDraggedItem}
                        onItemDrop={handleItemDrop}
                        showStoreName={activeStore === StoreName.KALI}
                    />
                ))}
                {activeStatus === OrderStatus.DISPATCHING && activeStore !== 'Settings' && (
                  <AddOrderDropZone />
                )}
              </div>
            )}
        </div>

        <AddSupplierModal isOpen={isAddSupplierModalOpen} onClose={() => { setAddSupplierModalOpen(false); setItemForNewOrder(null); }} onSelect={itemForNewOrder ? handleCreateOrderFromDrop : handleAddOrder} title={itemForNewOrder ? "Select Supplier for New Order" : (activeStatus === OrderStatus.COMPLETED ? "Add New Completed Order" : "Start a New Order")} />
        <PasteItemsModal isOpen={isPasteModalOpen} onClose={() => setPasteModalOpen(false)} />
        {headerContextMenu && <ContextMenu x={headerContextMenu.x} y={headerContextMenu.y} options={getMenuOptionsForDateGroup(headerContextMenu.dateGroupKey)} onClose={() => setHeaderContextMenu(null)} />}
        <MergeByPaymentModal isOpen={isMergeModalOpen} onClose={() => setIsMergeModalOpen(false)} onSelect={(method) => { if (window.confirm(`Are you sure you want to merge all of today's completed orders for ${method.toUpperCase()}? This action cannot be undone.`)) { actions.mergeTodaysCompletedOrdersByPayment(method); } }} />
        <DueReportModal isOpen={isDueReportModalOpen} onClose={() => setIsDueReportModalOpen(false)} orders={ordersForDueReport} />
        <ReceiptModal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} orders={ordersForReceipt} />
      </>
    );
  }
};

export default OrderWorkspace;
