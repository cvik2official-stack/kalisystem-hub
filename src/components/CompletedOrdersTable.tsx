import React from 'react';
import { Order } from '../types';

const CompletedOrdersTable: React.FC<{ orders: Order[] }> = ({ orders }) => {
  return (
    <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden lg:w-3/4 lg:mx-auto">
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-gray-800">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Order ID</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Supplier</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Items</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Completed At</th>
          </tr>
        </thead>
        <tbody className="bg-gray-800 divide-y divide-gray-700">
          {orders.sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()).map((order) => (
            <tr key={order.id} className="hover:bg-gray-700">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-400">{order.orderId}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{order.supplierName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{order.items.length}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                {order.completedAt ? new Date(order.completedAt).toLocaleString() : new Date(order.modifiedAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompletedOrdersTable;