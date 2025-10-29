import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { STATUS_TABS } from '../constants';
import SupplierCard from './SupplierCard';
import { OrderStatus, StoreName } from '../types';

const ManagerView: React.FC<{ storeName: string }> = ({ storeName }) => {
  const { state, dispatch } = useContext(AppContext);
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
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-white">Manager View: {storeName}</h1>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrders.map((order) => (
                <SupplierCard key={order.id} order={order} isManagerView={true} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerView;