
import React from 'react';
import { Order, PaymentMethod } from '../../types';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (method: PaymentMethod) => void;
  order: Order;
}

const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({ isOpen, onClose, onSelect, order }) => {
  if (!isOpen) return null;

  const paymentMethodBadgeColors: Record<string, string> = {
    [PaymentMethod.ABA]: 'bg-blue-900/30 text-blue-300 border-blue-500/50 hover:bg-blue-600 hover:text-white hover:border-blue-600',
    [PaymentMethod.CASH]: 'bg-green-900/30 text-green-300 border-green-500/50 hover:bg-green-600 hover:text-white hover:border-green-600',
    [PaymentMethod.KALI]: 'bg-purple-900/30 text-purple-300 border-purple-500/50 hover:bg-purple-600 hover:text-white hover:border-purple-600',
    [PaymentMethod.STOCK]: 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-600 hover:text-white hover:border-gray-500',
    [PaymentMethod.MISHA]: 'bg-orange-900/30 text-orange-300 border-orange-500/50 hover:bg-orange-600 hover:text-white hover:border-orange-600',
  };

  const handleSelect = (method: PaymentMethod) => {
    onSelect(method);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900/50">
            <h2 className="text-lg font-bold text-white">Payment Method</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 bg-gray-800 rounded-full hover:bg-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        
        <div className="p-4 space-y-3">
          {Object.values(PaymentMethod).map(method => (
            <button
              key={method}
              onClick={() => handleSelect(method)}
              className={`w-full text-center px-4 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 border ${paymentMethodBadgeColors[method]}`}
            >
              {method.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodModal;
