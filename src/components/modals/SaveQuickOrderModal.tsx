
import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import { Order, StoreName } from '../../types';

interface SaveQuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}

const SaveQuickOrderModal: React.FC<SaveQuickOrderModalProps> = ({ isOpen, onClose, orderId }) => {
  const { state, actions } = useContext(AppContext);
  const [name, setName] = useState('');
  const order = state.orders.find(o => o.id === orderId);

  // Map store names to their short codes for the bot preview
  const getStorePrefix = (store: string) => {
      switch(store) {
          case StoreName.CV2: return 'cv2';
          case StoreName.SHANTI: return 'sti';
          case StoreName.STOCK02: return 'o2';
          case StoreName.WB: return 'wb';
          default: return store.toLowerCase();
      }
  };

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

  const botCommandPreview = `/${getStorePrefix(order.store)}${name.trim().replace(/\s+/g, '')}`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        
        <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
            <h2 className="text-lg font-bold text-white">Save as Quick Order</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 bg-gray-800 rounded-full hover:bg-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <div className="p-6">
            <div className="mb-4">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bot Command Name</label>
                <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 outline-none border border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                    autoFocus
                    placeholder="e.g. salmon"
                />
            </div>
            
            {name.trim() && (
                <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-800">
                    <span className="text-xs text-gray-500 block mb-1">Generated Bot Command:</span>
                    <code className="text-green-400 font-mono text-sm bg-gray-900 px-2 py-1 rounded">{botCommandPreview}</code>
                </div>
            )}
            
            <div className="flex justify-end space-x-3 mt-6">
                <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-gray-400 hover:text-white font-medium hover:bg-gray-800 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={!name.trim()} className="px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold shadow-lg shadow-green-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SaveQuickOrderModal;
