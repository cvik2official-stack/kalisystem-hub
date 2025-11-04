import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { STATUS_TABS } from '../constants';
import SupplierCard from './SupplierCard';
import { Order, OrderStatus, StoreName } from '../types';

const ManagerView: React.FC<{ storeName: string }> = ({ storeName }) => {
  const { state, dispatch } = useContext(AppContext);
  const { orders } = state;
  const [activeStatus, setActiveStatus] = useState<OrderStatus>(OrderStatus.ON_THE_WAY);
  const [expandedGroups, setExpandedGroups] = useState(new Set<string>());

  const relevantStatuses = STATUS_TABS.filter(
    (tab) => tab.id === OrderStatus.ON_THE_WAY || tab.id === OrderStatus.COMPLETED
  );

  const handleExitManagerView = () => {
    dispatch({ type: 'SET_MANAGER_VIEW', payload: { isManager: false, store: null } });
    // Reset to default view
    dispatch({ type: 'SET_ACTIVE_STORE', payload: StoreName.CV2 }); 
    dispatch({ type: 'SET_ACTIVE_STATUS', payload: OrderStatus.DISPATCHING });
  };

  const filteredOrders = orders.filter(
    (order) => order.store === storeName && order.status === activeStatus
  );

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

  return (
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
        {/* Sync and settings buttons are intentionally omitted for Manager View */}
      </div>

      <div className="flex-grow p-4 flex flex-col">
        <main className="flex-grow flex flex-col">
          {/* Header to replace store tabs */}
          <div className="border-b border-gray-700">
             <div className="py-4 px-1">
                <h1 className="text-lg font-bold text-white">Manager <span className="font-medium text-indigo-400">{storeName}</span></h1>
             </div>
          </div>
          
          {/* Status Tabs */}
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

          {/* Orders Grid */}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
                          {groupedCompletedOrders[key].map((order) => (
                            <SupplierCard key={order.id} order={order} isManagerView={true} />
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
                  <SupplierCard key={order.id} order={order} isManagerView={true} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ManagerView;