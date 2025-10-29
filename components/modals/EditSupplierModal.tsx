import React, { useState, useEffect, useContext } from 'react';
import { Supplier } from '../../types';
import { AppContext } from '../../context/AppContext';

interface EditSupplierModalProps {
  supplier: Supplier;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSupplier: Supplier) => void;
}

const EditSupplierModal: React.FC<EditSupplierModalProps> = ({ supplier, isOpen, onClose, onSave }) => {
    const { state } = useContext(AppContext);
    const [name, setName] = useState<string>('');
    const [telegramGroupId, setTelegramGroupId] = useState('');

    useEffect(() => {
        setName(supplier.name);
        setTelegramGroupId(supplier.telegramGroupId || '');
    }, [supplier]);

    const handleSave = () => {
        // Fix: Do not save the name from the local state. The name is from an enum and should not be editable.
        // The spread `...supplier` will retain the original name with the correct type.
        onSave({
            ...supplier,
            telegramGroupId: telegramGroupId.trim(),
        });
        onClose();
    };
    
    if (!isOpen) return null;

    const isNew = !state.suppliers.some(s => s.id === supplier.id);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
            <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
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
                            value={name}
                            // Fix: The name is from an enum and should not be editable. This resolves the type error on save.
                            readOnly
                            className="mt-1 w-full bg-gray-700 border border-gray-700 text-gray-200 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500 opacity-70 cursor-not-allowed"
                        />
                    </div>
                    <div>
                        <label htmlFor="supplier-telegram" className="block text-sm font-medium text-gray-300">Telegram Group ID</label>
                        <input
                            type="text"
                            id="supplier-telegram"
                            value={telegramGroupId}
                            onChange={(e) => setTelegramGroupId(e.target.value)}
                            className="mt-1 w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
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
