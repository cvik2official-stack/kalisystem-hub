// FIX: Import 'useEffect' from 'react' to resolve 'Cannot find name' error.
import React, { useContext, useState, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { StoreName, OrderStatus, SupplierName, Order } from '../types';
import SupplierCard from './SupplierCard';
import NotificationBell from './NotificationBell';

interface ManagerViewProps {
  storeName: StoreName;
}

const ManagerView: React.FC<ManagerViewProps> = ({ storeName }) => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { orders, syncStatus } = state;
  const [activeStatus, setActiveStatus] = useState<OrderStatus>(OrderStatus.ON_THE_WAY);
  const [animateSyncSuccess, setAnimateSyncSuccess] = useState(false);
  const prevSyncStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevSyncStatusRef.current === 'syncing' && syncStatus === 'idle') {
      setAnimateSyncSuccess(true);
      const timer = setTimeout(() => setAnimateSyncSuccess(false), 1500);
      return () => clearTimeout(timer);
    }
    prevSyncStatusRef.current = syncStatus;
  }, [syncStatus]);

  const handleExitManagerView = () => {
    dispatch({ type: 'SET_MANAGER_VIEW', payload: { isManager: false, store: null } });
    dispatch({ type: 'SET_ACTIVE_STORE', payload: storeName }); 
    dispatch({ type: 'SET_ACTIVE_STATUS', payload: OrderStatus.DISPATCHING });
  };

  const isOudom = storeName === StoreName.OUDOM;

  const filteredOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = orders.filter(order => {
      // OUDOM manager logic
      if (isOudom) {
        return (order.supplierName === SupplierName.OUDOM || order.supplierName === SupplierName.STOCK) &&
               order.status === OrderStatus.ON_THE_WAY;
      }

      // Other managers see orders for their store matching the active tab's status
      if (order.store !== storeName || order.status !== activeStatus) {
        return false;
      }
      
      // For completed tab, only show today's orders
      if (activeStatus === OrderStatus.COMPLETED) {
        if (!order.completedAt) return false;
        const completedDate = new Date(order.completedAt);
        completedDate.setHours(0, 0, 0, 0);
        return completedDate.getTime() === today.getTime();
      }

      return true; // For 'On the Way'
    });
    
    // Sort orders by creation date
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, storeName, isOudom, activeStatus]);
  
  const tabs = isOudom ? 
    [{ id: OrderStatus.ON_THE_WAY, label: 'On the Way' }] :
    [{ id: OrderStatus.ON_THE_WAY, label: 'On the Way' }, { id: OrderStatus.COMPLETED, label: 'Completed' }];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <div className="bg-gray-800 shadow-2xl w-full md:w-1/2 md:mx-auto min-h-screen flex flex-col">
        <div className="flex-shrink-0 p-3 flex items-center justify-between border-b border-gray-700/50">
          <div onClick={handleExitManagerView} className="flex items-center space-x-2 cursor-pointer">
            <div className="flex space-x-1.5">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            </div>
            <h1 className="text-xs font-semibold text-gray-300">Kali System: Dispatch</h1>
          </div>
          <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white pr-2">Manager: {storeName}</span>
              <button
                  onClick={() => actions.syncWithSupabase()}
                  disabled={syncStatus === 'syncing'}
                  className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed p-1"
                  aria-label="Sync with database"
                  title="Sync with database"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-colors duration-300 ${syncStatus === 'syncing' ? 'animate-spin' : ''} ${animateSyncSuccess ? 'text-green-400 bounce-once-animation' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
              </button>
              <NotificationBell />
          </div>
        </div>
        
        <main className="flex-grow p-4 flex flex-col">
            <div className="border-b border-gray-700">
                <nav className="-mb-px flex space-x-6">
                {tabs.map((tab) => (
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
            
            <div className="flex-grow pt-4 overflow-y-auto hide-scrollbar">
              {filteredOrders.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredOrders.map(order => (
                    <SupplierCard
                      key={order.id}
                      order={order}
                      isManagerView={true}
                      isOudomManagerWorkflow={isOudom && (order.supplierName === SupplierName.OUDOM || order.supplierName === SupplierName.STOCK)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <p className="mt-4 text-gray-500">No active orders in this view.</p>
                </div>
              )}
            </div>
        </main>
      </div>
    </div>
  );
};

export default ManagerView;