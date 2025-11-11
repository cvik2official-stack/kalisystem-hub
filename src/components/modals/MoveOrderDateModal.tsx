import React, { useState, useEffect } from 'react';
import { Order } from '../../types';

interface MoveOrderDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newDate: string) => void;
  order: Order;
}

const MoveOrderDateModal: React.FC<MoveOrderDateModalProps> = ({ isOpen, onClose, onSave, order }) => {
  const [date, setDate] = useState('');

  useEffect(() => {
    if (isOpen && order.completedAt) {
      // Format the date to YYYY-MM-DD for the input
      const initialDate = new Date(order.completedAt);
      const year = initialDate.getFullYear();
      const month = String(initialDate.getMonth() + 1).padStart(2, '0');
      const day = String(initialDate.getDate()).padStart(2, '0');
      setDate(`${year}-${month}-${day}`);
    }
  }, [isOpen, order.completedAt]);

  const handleSave = () => {
    if (date) {
      onSave(date);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-2">Move Order</h2>
        <p className="text-sm text-gray-400 mb-4">
          Select a new completion date for the order from <span className="font-semibold text-gray-300">{order.supplierName}</span>.
        </p>
        
        <div>
          <label htmlFor="move-order-date" className="block text-sm font-medium text-gray-300">New Date</label>
          <input
            type="date"
            id="move-order-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
            style={{ colorScheme: 'dark' }} // Ensure date picker is dark
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={!date}
            className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-800 disabled:cursor-not-allowed"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveOrderDateModal;