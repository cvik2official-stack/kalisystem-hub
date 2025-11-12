import React, { useContext, useMemo, useState, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { StoreName, OrderStatus, SupplierName, Order, PaymentMethod } from '../types';
import SupplierCard from './SupplierCard';
import ManagerReportView from './ManagerReportView';
import NotificationBell from './NotificationBell';

interface ManagerViewProps {
  storeName: StoreName;
}

const ManagerView: React.FC<ManagerViewProps> = ({ storeName }) => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { orders, syncStatus, suppliers } = state;
  const [viewMode, setViewMode] = useState<'report' | 'card'>('report');
  
  const [animateSyncSuccess, setAnimateSyncSuccess] = useState(false);
  const prevSyncStatusRef = useRef<string | undefined>(undefined);

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
    dispatch({ type: 'SET_ACTIVE_STORE', payload: storeName }); 
    dispatch({ type: 'SET_ACTIVE_STATUS', payload: OrderStatus.DISPATCHING });
  };

  const isOudom = storeName === StoreName.OUDOM;
  const isWbStore = storeName === StoreName.WB;
  const isKaliManager = storeName === StoreName.KALI;

  const filteredOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const onTheWayOrders: Order[] = [];
    const completedTodayOrders: Order[] = [];

    orders.forEach(order => {
      if (isOudom) {
        if ((order.supplierName === SupplierName.OUDOM || order.supplierName === SupplierName.STOCK) &&
            order.status === OrderStatus.ON_THE_WAY) {
          onTheWayOrders.push(order);
        }
        return;
      }
      
      if (isKaliManager) {
        const supplier = suppliers.find(s => s.id === order.supplierId);
        const paymentMethod = order.paymentMethod || supplier?.paymentMethod;
        if (paymentMethod === PaymentMethod.KALI) {
            if (order.status === OrderStatus.ON_THE_WAY) {
                onTheWayOrders.push(order);
            } else if (order.status === OrderStatus.COMPLETED && order.completedAt) {
                const completedDate = new Date(order.completedAt);
                completedDate.setHours(0, 0, 0, 0);
                if (completedDate.getTime() === today.getTime()) {
                    completedTodayOrders.push(order);
                }
            }
        }
        return;
      }

      if (order.store !== storeName) return;
      
      if (order.status === OrderStatus.ON_THE_WAY) {
        onTheWayOrders.push(order);
      } else if (order.status === OrderStatus.COMPLETED && order.completedAt) {
          const completedDate = new Date(order.completedAt);
          completedDate.setHours(0, 0, 0, 0);
          if (completedDate.getTime() === today.getTime()) {
              completedTodayOrders.push(order);
          }
      }
    });

    onTheWayOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    completedTodayOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return [...onTheWayOrders, ...completedTodayOrders];
  }, [orders, storeName, isOudom, isKaliManager, suppliers]);

  const onTheWayCount = filteredOrders.filter(o => o.status === OrderStatus.ON_THE_WAY).length;
  
  const effectiveViewMode = (isWbStore || isKaliManager) ? 'report' : viewMode;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <div className="bg-gray-900 w-full md:w-1/2 md:mx-auto min-h-screen flex flex-col">
        <header className="flex-shrink-0 px-3 py-2 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
          <div 
            className="flex items-center space-x-2 cursor-pointer"
            onClick={handleExitManagerView}
            title="Exit Manager View"
          >
            <div className="flex space-x-1.5">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            </div>
            <h1 className="text-xs font-semibold text-gray-300">Kali System: Dispatch</h1>
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
          </div>
        </header>
        
        <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-bold text-white">Manager: {storeName}</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/50 text-yellow-300">
                {onTheWayCount} On The Way
            </span>
          </div>
          {!isWbStore && !isKaliManager && (
              <button
                onClick={() => setViewMode(viewMode === 'report' ? 'card' : 'report')}
                className="px-3 py-1 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {viewMode === 'report' ? 'Card View' : 'Report View'}
              </button>
          )}
        </div>

        <main className="flex-grow p-2 overflow-y-auto hide-scrollbar">
          {effectiveViewMode === 'report' ? (
            <ManagerReportView storeName={storeName} orders={filteredOrders} />
          ) : (
             filteredOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 justify-items-center">
                {filteredOrders.map(order => (
                  <SupplierCard
                    key={order.id}
                    order={order}
                    isManagerView={true}
                    isOudomManagerWorkflow={isOudom && (order.supplierName === SupplierName.OUDOM || order.supplierName === SupplierName.STOCK)}
                    // FIX: Provide a dummy function for onItemDrop as this view doesn't support item dragging.
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