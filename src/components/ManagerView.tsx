import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { STATUS_TABS } from '../constants';
import SupplierCard from './SupplierCard';
import { OrderStatus, StoreName } from '../types';
import CompletedOrdersTable from './CompletedOrdersTable';

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
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans antialiased">
      <div className="w-full lg:w-3/5 lg:mx-auto p-4">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Manager View: {storeName}</h1>
           <div className="flex items-center space-x-2">
              <div className="flex space-x-1.5">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              </div>
              <h2 className="text-xs font-semibold text-gray-300">Kali System</h2>
            </div>
        </header>

        <div className="border-b border-gray-700">
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

        <div className="mt-6">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No orders in this category.</p>
            </div>
          ) : (
             activeStatus !== OrderStatus.COMPLETED ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                  {filteredOrders.map((order) => (
                    <SupplierCard key={order.id} order={order} isManagerView={true} />
                  ))}
                </div>
             ) : (
                <CompletedOrdersTable orders={filteredOrders} />
             )
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerView;