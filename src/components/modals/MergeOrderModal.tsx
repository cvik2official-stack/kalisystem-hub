import React, { useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { Order } from '../../types';

interface MergeOrderModalProps {
  orderToMerge: Order;
  isOpen: boolean;
  onClose: () => void;
  onMerge: (destinationOrder: Order) => void;
}

const MergeOrderModal: React.FC<MergeOrderModalProps> = ({ orderToMerge, isOpen, onClose, onMerge }) => {
  const { state } = useContext(AppContext);

  const mergeCandidates = useMemo(() => {
    return state.orders.filter(
      (o) =>
        o.id !== orderToMerge.id && // Can't merge with itself
        o.store === orderToMerge.store && // Must be in the same store
        o.status === orderToMerge.status // Must have the same status
    );
  }, [state.orders, orderToMerge]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md flex flex-col border-t-4 border-indigo-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-4">Merge Order</h2>
        <p className="text-gray-400 mb-4 text-sm">
          Select an order to merge <span className="font-semibold text-indigo-300">{orderToMerge.supplierName}</span>'s items into. The original order will be deleted.
        </p>

        <div className="mt-4 flex-grow overflow-y-auto -mx-1 px-1" style={{maxHeight: '60vh'}}>
            {mergeCandidates.length > 0 ? (
                <div className="space-y-1">
                    {mergeCandidates.map(order => (
                        <button 
                            key={order.id} 
                            onClick={() => onMerge(order)} 
                            className="w-full text-left p-3 rounded-md hover:bg-indigo-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                        >
                            <p className="font-medium text-white">{order.supplierName}</p>
                            <p className="text-xs text-gray-400">{order.items.length} items</p>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                    <p className="mt-4 text-gray-500">No other active orders to merge with.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default MergeOrderModal;