import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Supplier, PaymentMethod, SupplierName } from '../../types';
import { AppContext } from '../../context/AppContext';

interface EditSupplierModalProps {
  supplier: Supplier;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSupplier: Supplier) => void;
}

const EditSupplierModal: React.FC<EditSupplierModalProps> = ({ supplier, isOpen, onClose, onSave }) => {
    const { state } = useContext(AppContext);
    const [name, setName] = useState<SupplierName>('' as SupplierName);
    const [chatId, setChatId] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(undefined);

    const isNew = useMemo(() => supplier.id.startsWith('new_'), [supplier.id]);

    useEffect(() => {
        if (supplier) {
            setName(supplier.name || '' as SupplierName);
            setChatId(supplier.chatId || '');
            setPaymentMethod(supplier.paymentMethod);
        }
    }, [supplier, isOpen]);

    const handleSave = () => {
        onSave({
            ...supplier,
            name: name.trim().toUpperCase() as SupplierName,
            chatId: chatId.trim(),
            paymentMethod: paymentMethod,
        });
        onClose();
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
            <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h2 className="text-xl font-bold text-white mb-4">{isNew ? 'Add Supplier' : 'Edit Supplier'}</h2>
                
                <div className="space-y-4">
                    <div>
                        <label htmlFor="supplier-name" className="block text-sm font-medium text-gray-300">Supplier Name</label>
                         <input
                            type="text"
                            id="supplier-name"
                            name="supplier-name"
                            value={name}
                            readOnly={!isNew}
                            onChange={(e) => setName(e.target.value.toUpperCase() as SupplierName)}
                            className={`mt-1 w-full border text-gray-200 rounded-md p-2 outline-none focus:ring-2 focus:ring-indigo-500 ${!isNew ? 'bg-gray-700 opacity-70 cursor-not-allowed border-gray-600' : 'bg-gray-900 border-gray-700'}`}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Payment Method</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.values(PaymentMethod).map(method => (
                                <button
                                    key={method}
                                    onClick={() => setPaymentMethod(method)}
                                    className={`px-3 py-2 text-sm rounded-md transition-colors ${paymentMethod === method ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                                >
                                    {method.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="supplier-chat-id" className="block text-sm font-medium text-gray-300">Chat ID</label>
                        <input
                            type="text"
                            id="supplier-chat-id"
                            name="supplier-chat-id"
                            value={chatId}
                            onChange={(e) => setChatId(e.target.value)}
                            placeholder="e.g., -1001234567890"
                            className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={handleSave} className="px-5 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditSupplierModal;