
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        
        <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
            <h2 className="text-lg font-bold text-white">Save Quick Order</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 bg-gray-800 rounded-full hover:bg-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <div className="p-5">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Order Name</label>
            <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none border border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                autoFocus
            />
            
            <div className="flex justify-end space-x-3 mt-6">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white font-medium hover:bg-gray-800 transition-colors">Cancel</button>
                <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold shadow-lg shadow-green-900/20 transition-all">Save</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SaveQuickOrderModal;
