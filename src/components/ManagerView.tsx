import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { StoreName, OrderStatus, SupplierName, Order } from '../types';
import SupplierCard from './SupplierCard';

interface ManagerViewProps {
  storeName: StoreName;
}

const ManagerView: React.FC<ManagerViewProps> = ({ storeName }) => {
  const { state, dispatch } = useContext(AppContext);
  const { orders } = state;

  const handleExitManagerView = () => {
    dispatch({ type: 'SET_MANAGER_VIEW', payload: { isManager: false, store: null } });
    // When exiting, set the active status back to a sensible default like DISPATCHING for the current store.
    dispatch({ type: 'SET_ACTIVE_STORE', payload: storeName }); 
    dispatch({ type: 'SET_ACTIVE_STATUS', payload: OrderStatus.DISPATCHING });
  };

  const isOudom = storeName === StoreName.OUDOM;

  const filteredOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const onTheWayOrders: Order[] = [];
    const completedTodayOrders: Order[] = [];

    orders.forEach(order => {
      // OUDOM manager sees orders for OUDOM and STOCK suppliers that are ON_THE_WAY.
      // They are task-based and don't need to see completed orders here.
      if (isOudom) {
        if ((order.supplierName === SupplierName.OUDOM || order.supplierName === SupplierName.STOCK) &&
            order.status === OrderStatus.ON_THE_WAY) {
          onTheWayOrders.push(order);
        }
        return;
      }

      // Other managers see orders for their store
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

    // Sort orders within their status groups by creation date
    onTheWayOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    completedTodayOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Show ON_THE_WAY orders first, then today's COMPLETED orders.
    return [...onTheWayOrders, ...completedTodayOrders];
  }, [orders, storeName, isOudom]);

  const onTheWayCount = filteredOrders.filter(o => o.status === OrderStatus.ON_THE_WAY).length;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <div className="bg-gray-800 shadow-2xl w-full md:w-1/2 md:mx-auto min-h-screen flex flex-col">
        <header className="flex-shrink-0 p-3 flex items-center justify-between border-b border-gray-700/50 sticky top-0 bg-gray-800 z-10">
          <div className="flex items-center space-x-3">
            <h1 className="text-lg font-bold text-white">Manager: {storeName}</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/50 text-yellow-300">
                {onTheWayCount} On The Way
            </span>
          </div>
          <button
            onClick={handleExitManagerView}
            className="px-3 py-1 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Exit View
          </button>
        </header>
        <main className="flex-grow p-4 overflow-y-auto hide-scrollbar">
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
              <p className="mt-4 text-gray-500">No active orders to manage.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ManagerView;
