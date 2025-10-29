// FIX: Implemented the OrderWorkspace component to replace the placeholder content.
import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { OrderStatus, StoreName, Supplier } from '../types';
import { STATUS_TABS } from '../constants';
import SupplierCard from './SupplierCard';
import PasteItemsModal from './modals/PasteItemsModal';
import AddSupplierModal from './modals/AddSupplierModal';
import CompletedOrdersTable from './CompletedOrdersTable';

const OrderWorkspace: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const { activeStore, activeStatus, orders } = state;
  const [isDragging, setIsDragging] = useState(false);
  const [isPasteModalOpen, setPasteModalOpen] = useState(false);
  const [isAddSupplierModalOpen, setAddSupplierModalOpen] = useState(false);

  if (activeStore === 'Settings') return null;

  const handleStatusChange = (status: OrderStatus) => {
    dispatch({ type: 'SET_ACTIVE_STATUS', payload: status });
  };
  
  const handleAddOrder = (supplier: Supplier) => {
    dispatch({ type: 'ADD_EMPTY_ORDER', payload: { supplier, store: activeStore as StoreName }});
    setAddSupplierModalOpen(false);
  };

  const filteredOrders = orders.filter(
    (order) => order.store === activeStore && order.status === activeStatus
  );

  return (
    <>
      <div className="mt-4 flex flex-col flex-grow">
        {/* Status Tabs */}
        <div className="border-b border-gray-700">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleStatusChange(tab.id)}
                className={`
                  whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
                  ${
                    activeStatus === tab.id
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        
        {/* Action Buttons */}
        {activeStatus === OrderStatus.DISPATCHING && (
            <div className="py-4 flex items-center space-x-3">
                <button 
                    onClick={() => setAddSupplierModalOpen(true)}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                    + Add Order
                </button>
                <button
                    onClick={() => setPasteModalOpen(true)}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-500 text-gray-200"
                >
                    Paste List
                </button>
            </div>
        )}

        {/* Orders Grid */}
        <div className="flex-grow pt-2 pb-4 overflow-y-auto hide-scrollbar">
            {filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">No orders in this category.</p>
                </div>
            ) : (
                activeStatus !== OrderStatus.COMPLETED ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {filteredOrders
                            .sort((a, b) => a.supplierName.localeCompare(b.supplierName))
                            .map((order) => (
                                <SupplierCard
                                    key={order.id}
                                    order={order}
                                    isCollapsedByDrag={isDragging}
                                    onItemDragStart={() => setIsDragging(true)}
                                    onItemDragEnd={() => setIsDragging(false)}
                                />
                        ))}
                    </div>
                ) : (
                    <CompletedOrdersTable orders={filteredOrders} />
                )
            )}
        </div>
      </div>
      
      <PasteItemsModal isOpen={isPasteModalOpen} onClose={() => setPasteModalOpen(false)} />
      <AddSupplierModal 
        isOpen={isAddSupplierModalOpen} 
        onClose={() => setAddSupplierModalOpen(false)} 
        onSelect={handleAddOrder}
        title="Create New Order For"
      />
    </>
  );
};

export default OrderWorkspace;
