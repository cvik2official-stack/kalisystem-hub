import React, { useState } from 'react';
import { Order } from '../types';

const CompletedOrdersTable: React.FC<{ orders: Order[] }> = ({ orders }) => {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const handleRowClick = (orderId: string) => {
    setExpandedOrderId(currentId => (currentId === orderId ? null : orderId));
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden lg:w-3/4 lg:mx-auto">
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-gray-800">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Items</th>
          </tr>
        </thead>
        <tbody className="bg-gray-800 divide-y divide-gray-700">
          {orders.sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()).map((order) => (
            <React.Fragment key={order.id}>
              <tr onClick={() => handleRowClick(order.id)} className="hover:bg-gray-700 cursor-pointer">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{formatDate(order.completedAt)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{order.items.length}</td>
              </tr>
              {expandedOrderId === order.id && (
                <tr className="bg-gray-900/50">
                  <td colSpan={2} className="px-12 py-4">
                    <div className="mb-2 text-sm font-semibold text-white">{order.supplierName}</div>
                    {order.items.length > 0 ? (
                      <ul className="space-y-2">
                        {order.items.map(item => (
                          <li key={item.itemId} className="flex justify-between text-sm">
                            <span className="text-gray-300">{item.name}</span>
                            <span className="font-semibold text-white">{item.quantity}{item.unit}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-center text-gray-500">This order had no items.</p>
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompletedOrdersTable;