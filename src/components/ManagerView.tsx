
import React, { useContext, useMemo, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { StoreName, OrderStatus, SupplierName, Order, PaymentMethod } from '../types';
import SupplierCard from './SupplierCard';
import ManagerReportView from './ManagerReportView';
import NotificationBell from './NotificationBell';

const ManagerView: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { orders, syncStatus, managerStoreFilter } = state;
  const [viewMode, setViewMode] = useState<'report' | 'card'>('report');
  
  const [animateSyncSuccess, setAnimateSyncSuccess] = useState(false);
  const prevSyncStatusRef = useRef<string | undefined>(undefined);

  const storeName = managerStoreFilter;
  if (!storeName) return null; // Should not happen if isManagerView is true

  useEffect(() => {
    if (prevSyncStatusRef.current === 'syncing' && syncStatus === 'idle') {
      setAnimateSyncSuccess(true);
      const timer = setTimeout(() => {
        setAnimateSyncSuccess(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
    prevSyncStatusRef.current = syncStatus;
  }, [syncStatus]);

  const handleExitManagerView = () => {
    dispatch({ type: 'SET_MANAGER_VIEW', payload: { isManager: false, store: null } });
    // Also reset active store to prevent being "stuck"
    dispatch({ type: 'SET_ACTIVE_STORE', payload: storeName });
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => order.store === storeName);
  }, [orders, storeName]);

  const onTheWayCount = useMemo(() => {
    return filteredOrders.filter(o => o.status === OrderStatus.ON_THE_WAY).length;
  }, [filteredOrders]);
  
  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <div className="bg-gray-900 w-full md:w-1/2 md:mx-auto min-h-screen flex flex-col">
        <header className="flex-shrink-0 px-3 py-2 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
                <button onClick={handleExitManagerView} title="Exit Manager View">
                  <span className="w-4 h-4 bg-red-500 rounded-full block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-red-500"></span>
                </button>
                 <span className="w-4 h-4 bg-yellow-400 rounded-full block opacity-50"></span>
                 <span className="w-4 h-4 bg-green-500 rounded-full block opacity-50"></span>
            </div>
            <h1 className="text-lg font-bold text-white">Manager: {storeName}</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/50 text-yellow-300">
                {onTheWayCount} On The Way
            </span>
          </div>

          <div className="flex items-center space-x-2">
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
              <button
                onClick={() => setViewMode(viewMode === 'report' ? 'card' : 'report')}
                className="px-3 py-1 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {viewMode === 'report' ? 'Card View' : 'Report View'}
              </button>
          </div>
        </header>
        
        <main className="flex-grow p-2 overflow-y-auto hide-scrollbar">
          {viewMode === 'report' ? (
            <ManagerReportView orders={filteredOrders} onItemDrop={() => {}} singleColumn="on_the_way" />
          ) : (
             filteredOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-center">
                {filteredOrders.map(order => (
                  <SupplierCard
                    key={order.id}
                    order={order}
                    onItemDrop={() => {}}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002 2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="mt-4 text-gray-500">No active orders to manage.</p>
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
};

export default ManagerView;