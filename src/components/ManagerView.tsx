import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { STATUS_TABS } from '../constants';
import SupplierCard from './SupplierCard';
import { Order, OrderStatus, StoreName, PaymentMethod, Supplier, SupplierName } from '../types';
import ContextMenu from './ContextMenu';
import MergeByPaymentModal from './modals/MergeByPaymentModal';
import AddSupplierModal from './modals/AddSupplierModal';
import { useToasts } from '../context/ToastContext';
import { generateStoreReport } from '../utils/messageFormatter';

const ManagerView: React.FC<{ storeName: string }> = ({ storeName }) => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { orders, isEditModeEnabled } = state;
  const { addToast } = useToasts();
  const [activeStatus, setActiveStatus] = useState<OrderStatus>(OrderStatus.ON_THE_WAY);
  const [expandedGroups, setExpandedGroups] = useState(new Set<string>(['Today']));
  
  const [headerContextMenu, setHeaderContextMenu] = useState<{ x: number, y: number } | null>(null);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isAddSupplierModalOpen, setAddSupplierModalOpen] = useState(false);

  const relevantStatuses = STATUS_TABS.filter(
    (tab) => tab.id === OrderStatus.ON_THE_WAY || tab.id === OrderStatus.COMPLETED
  );

  const handleExitManagerView = () => {
    dispatch({ type: 'SET_MANAGER_VIEW', payload: { isManager: false, store: null } });
    dispatch({ type: 'SET_EDIT_MODE', payload: false });
    dispatch({ type: 'SET_ACTIVE_STORE', payload: StoreName.CV2 }); 
    dispatch({ type: 'SET_ACTIVE_STATUS', payload: OrderStatus.DISPATCHING });
  };

  const filteredOrders = useMemo(() => {
    let filtered: Order[];

    if (storeName === StoreName.OUDOM) {
        // Special view for OUDOM manager: show OUDOM and STOCK suppliers
        filtered = orders.filter(order => 
            (order.supplierName === SupplierName.OUDOM || order.supplierName === SupplierName.STOCK) &&
            order.status === activeStatus
        );
    } else {
        // Standard manager view for other stores
        filtered = orders.filter(order => 
            order.store === storeName && 
            order.status === activeStatus
        );
    }
    
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, storeName, activeStatus]);
  
  const handleAddNewCard = (supplier: Supplier) => {
    actions.addOrder(supplier, storeName as StoreName, [], OrderStatus.COMPLETED);
    setAddSupplierModalOpen(false);
  };

  const handleGenerateStoreReport = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysCompletedOrders = orders.filter(o => {
      if (o.status !== OrderStatus.COMPLETED || !o.completedAt || o.store !== storeName) return false;
      const completedDate = new Date(o.completedAt);
      completedDate.setHours(0, 0, 0, 0);
      return completedDate.getTime() === today.getTime();
    });
    
    if (todaysCompletedOrders.length === 0) {
        addToast("No completed orders for today to generate a report.", 'info');
        return;
    }
    
    const reportText = generateStoreReport(todaysCompletedOrders);
    navigator.clipboard.writeText(reportText).then(() => {
        addToast('Store report copied to clipboard!', 'success');
    }).catch(err => {
        addToast(`Failed to copy report: ${err}`, 'error');
    });
  };

  const groupedCompletedOrders = useMemo(() => {
    if (activeStatus !== OrderStatus.COMPLETED) return {};

    const groups: Record<string, Order[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filteredOrders.forEach(order => {
      const completedDate = new Date(order.completedAt || 0);
      completedDate.setHours(0, 0, 0, 0);
      
      const key = completedDate.getTime() === today.getTime() ? 'Today' : completedDate.toISOString().split('T')[0];
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(order);
    });

    for (const key in groups) {
      groups[key].sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
    }
    return groups;
  }, [filteredOrders, activeStatus]);

  const sortedCompletedGroupKeys = useMemo(() => {
    const keys = Object.keys(groupedCompletedOrders);
    return keys.sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      return new Date(b).getTime() - new Date(a).getTime();
    });
  }, [groupedCompletedOrders]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
        const newSet = new Set(prev);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        return newSet;
    });
  };

  const formatDateGroupHeader = (key: string): string => {
    if (key === 'Today') return 'Today';
    const date = new Date(key);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = String(date.getFullYear()).slice(-2);
    
    return `${day}.${month}.${year}`;
  };
  
  const headerContextMenuOptions = [
    { label: isEditModeEnabled ? 'Disable Edit' : 'Enable Edit', action: () => dispatch({ type: 'SET_EDIT_MODE', payload: !isEditModeEnabled }) },
    { label: 'Merge by Payment...', action: () => setIsMergeModalOpen(true) },
    { label: 'New Card...', action: () => setAddSupplierModalOpen(true) },
    { label: 'Store Report', action: handleGenerateStoreReport },
  ];

  const isOudomManagerWorkflow = storeName === StoreName.OUDOM;

  return (
    <>
      <div className="bg-gray-800 shadow-2xl w-full lg:w-3/5 lg:mx-auto min-h-screen flex flex-col">
        <div className="flex-shrink-0 p-3 flex items-center justify-between border-b border-gray-700/50">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1.5">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            </div>
            <button onClick={handleExitManagerView} className="text-left" title="Exit Manager View">
              <h1 className="text-xs font-semibold text-gray-300 hover:text-indigo-400 transition-colors">Kali System: Dispatch</h1>
            </button>
          </div>
        </div>

        <div className="flex-grow p-4 flex flex-col">
          <main className="flex-grow flex flex-col">
            <div className="border-b border-gray-700">
              <div className="py-4 px-1">
                  <h1 className="text-lg font-bold text-white">Manager <span className="font-medium text-indigo-400">{storeName}</span></h1>
              </div>
            </div>
            
            <div className="mt-4 border-b border-gray-700">
              <nav className="-mb-px flex space-x-6">
                {relevantStatuses.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveStatus(tab.id)}
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

            <div className="flex-grow pt-2 pb-4 overflow-y-auto hide-scrollbar">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No orders in this category.</p>
                </div>
              ) : activeStatus === OrderStatus.COMPLETED ? (
                <div className="mt-4">
                  {sortedCompletedGroupKeys.map(key => {
                    const isExpanded = expandedGroups.has(key);
                    return (
                      <div key={key}>
                        <div className="bg-gray-900/50 px-4 py-2 flex justify-between items-center border-b border-t border-gray-700 w-full text-left">
                          <button onClick={() => toggleGroup(key)} className="flex items-center space-x-2 flex-grow">
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-400 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            <h3 className="font-semibold text-white">{formatDateGroupHeader(key)}</h3>
                          </button>
                          {key === 'Today' && (
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setHeaderContextMenu({ x: rect.left, y: rect.bottom + 5 }); }} className="p-1 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white" aria-label="Today's Actions">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                            </button>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
                            {groupedCompletedOrders[key].map((order) => (
                              <SupplierCard key={order.id} order={order} isManagerView={true} isEditModeEnabled={isEditModeEnabled} isOudomManagerWorkflow={isOudomManagerWorkflow} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                  {filteredOrders.map((order) => (
                    <SupplierCard key={order.id} order={order} isManagerView={true} isOudomManagerWorkflow={isOudomManagerWorkflow} />
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
      {headerContextMenu && (
          <ContextMenu
              x={headerContextMenu.x}
              y={headerContextMenu.y}
              options={headerContextMenuOptions}
              onClose={() => setHeaderContextMenu(null)}
          />
      )}
      <MergeByPaymentModal
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
          onSelect={(method) => {
              if (window.confirm(`Are you sure you want to merge all of today's completed orders for ${method.toUpperCase()}? This action cannot be undone.`)) {
                  actions.mergeTodaysCompletedOrdersByPayment(method);
              }
          }}
      />
      <AddSupplierModal
        isOpen={isAddSupplierModalOpen}
        onClose={() => setAddSupplierModalOpen(false)}
        onSelect={handleAddNewCard}
        title="Add New Completed Order"
      />
    </>
  );
};

export default ManagerView;