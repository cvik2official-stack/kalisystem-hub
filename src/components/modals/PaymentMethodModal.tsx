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
    [PaymentMethod.ABA]: 'bg-blue-500/50 text-blue-300 hover:bg-blue-500 hover:text-white',
    [PaymentMethod.CASH]: 'bg-green-500/50 text-green-300 hover:bg-green-500 hover:text-white',
    [PaymentMethod.KALI]: 'bg-purple-500/50 text-purple-300 hover:bg-purple-500 hover:text-white',
    [PaymentMethod.STOCK]: 'bg-gray-500/50 text-gray-300 hover:bg-gray-500 hover:text-white',
  };

  const handleSelect = (method: PaymentMethod) => {
    onSelect(method);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-white mb-6">Set Payment Method</h2>
        
        <div className="flex flex-col space-y-2">
          {Object.values(PaymentMethod).map(method => (
            <button
              key={method}
              onClick={() => handleSelect(method)}
              className={`w-full text-center px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 ${paymentMethodBadgeColors[method]}`}
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