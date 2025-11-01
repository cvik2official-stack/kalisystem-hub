
import React, { useState, useMemo, useContext } from 'react';
import { Order, PaymentMethod, Item } from '../types';
import { AppContext } from '../context/AppContext';
import { useToasts } from '../context/ToastContext';
import ConfirmationModal from './modals/ConfirmationModal';
import { generateOrderMessage } from '../utils/messageFormatter';
import { generateInvoiceImage } from '../services/geminiService';
import { uploadFileToStorage } from '../services/supabaseService';
import { exportCrmSummary } from '../services/reportingService';

const CompletedOrdersTable: React.FC<{ orders: Order[] }> = ({ orders }) => {
  const { state, actions } = useContext(AppContext);
  const { addToast } = useToasts();
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const groupedOrders = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    orders.forEach(order => {
      const completedDate = new Date(order.completedAt || 0);
      completedDate.setHours(0, 0, 0, 0);
      
      const key = completedDate.getTime() === today.getTime() ? 'Today' : completedDate.toISOString().split('T')[0];
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(order);
    });

    // Sort orders within each group
    for (const key in groups) {
      groups[key].sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
    }

    return groups;
  }, [orders]);

  const sortedGroupKeys = useMemo(() => {
    const keys = Object.keys(groupedOrders);
    return keys.sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      return new Date(b).getTime() - new Date(a).getTime();
    });
  }, [groupedOrders]);

  const formatDateGroupHeader = (key: string): string => {
    if (key === 'Today') return 'Today';
    const date = new Date(key);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleShare = (order: Order) => {
    const message = generateOrderMessage(order, 'plain');
    navigator.clipboard.writeText(message).then(() => {
      addToast('Order message copied!', 'success');
    });
  };

  const handlePrint = async (order: Order) => {
    setIsProcessing(true);
    addToast('Generating invoice with AI...', 'info');
    try {
        const { geminiApiKey, supabaseUrl, supabaseKey } = state.settings;
        if (!geminiApiKey) throw new Error('Gemini API key is not set.');
        
        const base64Image = await generateInvoiceImage(order, geminiApiKey);
        const imageBlob = await (await fetch(`data:image/png;base64,${base64Image}`)).blob();

        addToast('Uploading invoice to cloud storage...', 'info');
        const filePath = `invoices/${order.store}/${order.orderId}.png`;
        const { publicUrl } = await uploadFileToStorage({
            bucket: 'invoices',
            filePath,
            file: imageBlob,
            url: supabaseUrl,
            key: supabaseKey,
        });

        // Update the order in the database with the new URL
        await actions.updateOrder({ ...order, invoiceUrl: publicUrl });

        window.open(publicUrl, '_blank');
        addToast('Invoice generated and saved successfully!', 'success');

    } catch (e: any) {
        addToast(`Invoice generation failed: ${e.message}`, 'error');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleExport = async (dateKey: string) => {
    setIsProcessing(true);
    addToast(`Exporting summary for ${dateKey}...`, 'info');
    try {
        const { googleApiCredentials } = state.settings;
        if (!googleApiCredentials) {
            throw new Error('Google API credentials are not set in Options.');
        }

        const ordersToExport = groupedOrders[dateKey];
        const suppliers = state.suppliers;

        await exportCrmSummary({
            orders: ordersToExport,
            suppliers,
            date: dateKey === 'Today' ? new Date().toISOString().split('T')[0] : dateKey,
            credentials: googleApiCredentials,
        });

        addToast(`Successfully exported summary for ${dateKey}.`, 'success');
    } catch (e: any) {
        addToast(`Export failed: ${e.message}`, 'error');
    } finally {
        setIsProcessing(false);
    }
  };

  const paymentMethodBadgeColors: Record<string, string> = {
    [PaymentMethod.ABA]: 'bg-blue-500/50 text-blue-300',
    [PaymentMethod.CASH]: 'bg-green-500/50 text-green-300',
    [PaymentMethod.KALI]: 'bg-purple-500/50 text-purple-300',
    [PaymentMethod.STOCK]: 'bg-gray-500/50 text-gray-300',
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      {isProcessing && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-20 rounded-xl">
          <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
      {sortedGroupKeys.map(key => (
        <div key={key} className="mb-4 last:mb-0">
          <div className="bg-gray-900/50 px-4 py-2 flex justify-between items-center border-b border-t border-gray-700">
            <h3 className="font-semibold text-white">{formatDateGroupHeader(key)}</h3>
            <button
              onClick={() => handleExport(key)}
              className="px-3 py-1 text-xs font-medium rounded-md bg-green-600 hover:bg-green-700 text-white disabled:bg-green-800"
              disabled={isProcessing}
            >
              Export
            </button>
          </div>
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th scope="col" className="pl-4 pr-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Order</th>
                <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Payment</th>
                <th scope="col" className="pl-2 pr-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {groupedOrders[key].map(order => {
                const supplier = state.suppliers.find(s => s.id === order.supplierId);
                return (
                  <tr key={order.id}>
                    <td className="pl-4 pr-2 py-3 whitespace-nowrap">
                      <div className="text-sm text-white font-mono">{order.orderId}</div>
                      <div className="text-xs text-gray-400">{order.items.length} items from {order.supplierName}</div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-300">
                      {supplier?.paymentMethod ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${paymentMethodBadgeColors[supplier.paymentMethod]}`}>
                          {supplier.paymentMethod.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="pl-2 pr-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => setOrderToDelete(order)} className="text-gray-400 hover:text-red-400" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                        <button onClick={() => handlePrint(order)} className="text-gray-400 hover:text-indigo-400" title="Print Invoice"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg></button>
                        <button onClick={() => handleShare(order)} className="text-gray-400 hover:text-blue-400" title="Share"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      {orderToDelete && (
        <ConfirmationModal
          isOpen={!!orderToDelete}
          onClose={() => setOrderToDelete(null)}
          onConfirm={() => {
            actions.deleteOrder(orderToDelete.id);
            setOrderToDelete(null);
          }}
          title="Delete Order"
          message={`Are you sure you want to delete order ${orderToDelete.orderId}?`}
          isDestructive
        />
      )}
    </div>
  );
};

export default CompletedOrdersTable;