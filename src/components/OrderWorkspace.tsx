import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { OrderStatus } from '../types';
import SupplierCard from './SupplierCard';
import { STATUS_TABS } from '../constants';
import { getPhnomPenhDateKey } from '../utils/messageFormatter';

const OrderWorkspace: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { orders, activeStore, activeStatus, isSmartView } = state;

  const handleStatusChange = (status: OrderStatus) => {
    dispatch({ type: 'SET_ACTIVE_STATUS', payload: status });
  };

  const handleItemDrop = async (destinationOrderId: string) => {
      if (state.draggedItem) {
          const { item, sourceOrderId } = state.draggedItem;
          if (sourceOrderId === destinationOrderId) return;

          const destOrder = orders.find(o => o.id === destinationOrderId);
          if (!destOrder) return;

          const newItems = [...destOrder.items];
          const existingIndex = newItems.findIndex(i => i.itemId === item.itemId && i.isSpoiled === item.isSpoiled);
          if (existingIndex > -1) {
              newItems[existingIndex].quantity += item.quantity;
          } else {
              newItems.push(item);
          }
          await actions.updateOrder({ ...destOrder, items: newItems });
          await actions.deleteItemFromOrder(item, sourceOrderId);
      }
  };

  const smartViewOrders = useMemo(() => {
    const todayKey = getPhnomPenhDateKey();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = getPhnomPenhDateKey(yesterdayDate);

    return orders.filter(order => {
        if (activeStore !== 'ALL' && activeStore !== 'Settings' && order.store !== activeStore) {
            return false;
        }

        if (order.status === OrderStatus.DISPATCHING || order.status === OrderStatus.ON_THE_WAY) {
            return true;
        }
        if (order.status === OrderStatus.COMPLETED && order.completedAt) {
            const completedDateKey = getPhnomPenhDateKey(order.completedAt);
            return completedDateKey === todayKey || completedDateKey === yesterdayKey;
        }
        return false;
    });
  }, [orders, activeStore]);

  if (isSmartView) {
      const dispatchOrders = smartViewOrders.filter(o => o.status === OrderStatus.DISPATCHING);
      const onWayOrders = smartViewOrders.filter(o => o.status === OrderStatus.ON_THE_WAY);
      const completedOrders = smartViewOrders.filter(o => o.status === OrderStatus.COMPLETED);

      return (
          <div className="flex-grow overflow-x-auto overflow-y-hidden h-full p-2">
              <div className="flex h-full space-x-4 min-w-max">
                  <div className="w-80 flex flex-col bg-gray-800/30 rounded-lg p-2">
                      <h3 className="text-blue-400 font-bold mb-2 sticky top-0">Dispatch ({dispatchOrders.length})</h3>
                      <div className="overflow-y-auto hide-scrollbar space-y-2 flex-grow">
                          {dispatchOrders.map(order => (
                              <SupplierCard key={order.id} order={order} onItemDrop={handleItemDrop} showStoreName={activeStore === 'ALL'} />
                          ))}
                      </div>
                  </div>
                   <div className="w-80 flex flex-col bg-gray-800/30 rounded-lg p-2">
                      <h3 className="text-yellow-400 font-bold mb-2 sticky top-0">On The Way ({onWayOrders.length})</h3>
                      <div className="overflow-y-auto hide-scrollbar space-y-2 flex-grow">
                          {onWayOrders.map(order => (
                              <SupplierCard key={order.id} order={order} onItemDrop={handleItemDrop} showStoreName={activeStore === 'ALL'} />
                          ))}
                      </div>
                  </div>
                   <div className="w-80 flex flex-col bg-gray-800/30 rounded-lg p-2">
                      <h3 className="text-green-500 font-bold mb-2 sticky top-0">Completed (Recent)</h3>
                      <div className="overflow-y-auto hide-scrollbar space-y-2 flex-grow">
                          {completedOrders.map(order => (
                              <SupplierCard key={order.id} order={order} onItemDrop={handleItemDrop} showStoreName={activeStore === 'ALL'} />
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  const filteredOrders = orders.filter(order => {
      if (activeStore !== 'ALL' && activeStore !== 'Settings' && order.store !== activeStore) return false;
      return order.status === activeStatus;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

  return (
    <div className="flex flex-col h-full">
        <div className="flex justify-center space-x-4 mb-2 border-b border-gray-700">
            {STATUS_TABS.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => handleStatusChange(tab.id)}
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${activeStatus === tab.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
        <div className="flex-grow overflow-y-auto p-2 hide-scrollbar">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center">
                 {sortedOrders.map(order => (
                     <SupplierCard key={order.id} order={order} onItemDrop={handleItemDrop} showStoreName={activeStore === 'ALL'} />
                 ))}
                 {sortedOrders.length === 0 && (
                     <div className="col-span-full text-center text-gray-500 mt-10">
                         No orders in {activeStatus}
                     </div>
                 )}
             </div>
        </div>
    </div>
  );
};

export default OrderWorkspace;