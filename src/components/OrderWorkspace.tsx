// FIX: Implemented the OrderWorkspace component to replace the placeholder content.
import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { OrderStatus, StoreName, Supplier } from '../types';
import { STATUS_TABS } from '../constants';
import SupplierCard from './SupplierCard';
import PasteItemsModal from './modals/PasteItemsModal';
import AddSupplierModal from './modals/AddSupplierModal';
import CompletedOrdersTable from './CompletedOrdersTable';

const OrderWorkspace: React.FC = () => {
  const { state, dispatch, actions } = useContext(AppContext);
  const { activeStore, activeStatus, orders } = state;
  const [isDragging, setIsDragging] = useState(false);
  const [isPasteModalOpen, setPasteModalOpen] = useState(false);
  const [isAddSupplierModalOpen, setAddSupplierModalOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);

  if (activeStore === 'Settings') return null;

  const handleStatusChange = (status: OrderStatus) => {
    dispatch({ type: 'SET_ACTIVE_STATUS', payload: status });
  };
  
  const handleAddOrder = (supplier: Supplier) => {
    // FIX: Removed redundant check for 'Settings'. The type of `activeStore` is already narrowed by the check at the top of the component.
    actions.addOrder(supplier, activeStore as StoreName);
    setAddSupplierModalOpen(false);
  };

  const filteredOrders = orders.filter(
    (order) => order.store === activeStore && order.status === activeStatus
  );

  const handlePressStart = () => {
    if (activeStatus === OrderStatus.DISPATCHING) {
      longPressTimer.current = window.setTimeout(() => {
          setPasteModalOpen(true);
      }, 500);
    }
  };

  const handlePressEnd = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

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
                onMouseDown={tab.id === OrderStatus.DISPATCHING ? handlePressStart : undefined}
                onMouseUp={tab.id === OrderStatus.DISPATCHING ? handlePressEnd : undefined}
                onMouseLeave={tab.id === OrderStatus.DISPATCHING ? handlePressEnd : undefined}
                onTouchStart={tab.id === OrderStatus.DISPATCHING ? handlePressStart : undefined}
                onTouchEnd={tab.id === OrderStatus.DISPATCHING ? handlePressEnd : undefined}
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
        
        {/* Orders Grid */}
        <div className="flex-grow pt-4 pb-4 overflow-y-auto hide-scrollbar">
            {filteredOrders.length === 0 ? (
                activeStatus === OrderStatus.DISPATCHING ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500 mb-4">No orders in this category.</p>
                        <button
                            onClick={() => setAddSupplierModalOpen(true)}
                            className="text-indigo-400 hover:text-indigo-300 font-medium text-sm"
                        >
                            + Add an Order
                        </button>
                        <span className="text-gray-600 mx-2">or</span>
                        <button
                            onClick={() => setPasteModalOpen(true)}
                            className="text-indigo-400 hover:text-indigo-300 font-medium text-sm"
                        >
                            Paste a List
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-gray-500">No orders in this category.</p>
                    </div>
                )
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
                         {activeStatus === OrderStatus.DISPATCHING && (
                            <div className="bg-gray-800 rounded-xl shadow-lg flex flex-col items-center justify-center p-6 border-t-4 border-blue-500 transition-all duration-300 min-h-[220px]">
                                <div className="text-center flex flex-col items-center space-y-2">
                                    <button 
                                        onClick={() => setAddSupplierModalOpen(true)} 
                                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                                    >
                                        + select supplier
                                    </button>
                                    <p className="text-gray-600 text-xs">or</p>
                                    <button 
                                        onClick={() => setPasteModalOpen(true)}
                                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                                    >
                                        paste a list
                                    </button>
                                </div>
                            </div>
                        )}
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