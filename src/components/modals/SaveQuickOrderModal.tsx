import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import { Order } from '../../types';

interface SaveQuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}

const SaveQuickOrderModal: React.FC<SaveQuickOrderModalProps> = ({ isOpen, onClose, orderId }) => {
  const { state, actions } = useContext(AppContext);
  const [name, setName] = useState('');
  const order = state.orders.find(o => o.id === orderId);

  useEffect(() => {
    if (isOpen && order) {
      // Default naming convention: Store_Supplier_ItemCount
      setName(`${order.store}_${order.supplierName}_${order.items.length}items`);
    }
  }, [isOpen, order]);

  const handleSave = () => {
    if (order && name.trim()) {
        actions.addQuickOrder({
            name: name.trim(),
            store: order.store,
            supplierId: order.supplierId,
            supplierName: order.supplierName,
            items: order.items,
        });
        onClose();
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-green-500" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Save Quick Order</h2>
        <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-1">Order Name</label>
            <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full bg-gray-900 text-white rounded p-2 outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
            />
        </div>
        <div className="flex justify-end space-x-2">
            <button onClick={onClose} className="px-4 py-2 rounded text-gray-300 hover:bg-gray-700">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-500">Save</button>
        </div>
      </div>
    </div>
  );
};

export default SaveQuickOrderModal;