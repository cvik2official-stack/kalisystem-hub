import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { STATUS_TABS } from '../constants';
import SupplierCard from './SupplierCard';
import { OrderStatus } from '../types';

const ManagerView: React.FC<{ storeName: string }> = ({ storeName }) => {
  const { state } = useContext(AppContext);
  const { orders } = state;
  const [activeStatus, setActiveStatus] = React.useState<OrderStatus>(OrderStatus.ON_THE_WAY);

  const relevantStatuses = STATUS_TABS.filter(
    (tab) => tab.id === OrderStatus.ON_THE_WAY || tab.id === OrderStatus.COMPLETED
  );

  const filteredOrders = orders.filter(
    (order) => order.store === storeName && order.status === activeStatus
  );

  return (
    <div className="bg-gray-800 shadow-2xl w-full lg:w-3/5 lg:mx-auto min-h-screen flex flex-col">
      <div className="flex-shrink-0 p-3 flex items-center justify-between border-b border-gray-700/50">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span>
            <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
          </div>
          <h1 className="text-xs font-semibold text-gray-300">Kali System: Dispatch</h1>
        </div>
        {/* Sync and settings buttons are intentionally omitted for Manager View */}
      </div>

      <div className="flex-grow p-4 flex flex-col">
        <main className="flex-grow flex flex-col">
          {/* Header to replace store tabs */}
          <div className="border-b border-gray-700">
             <div className="py-4 px-1">
                <h1 className="text-lg font-bold text-white">Manager View: <span className="font-medium text-indigo-400">{storeName}</span></h1>
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
          <div className="flex-grow pt-6 pb-4 overflow-y-auto hide-scrollbar">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No orders in this category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
