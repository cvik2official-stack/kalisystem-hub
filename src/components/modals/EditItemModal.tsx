import React, { useState, useEffect, useContext } from 'react';
import { Item, Unit } from '../../types';
import { AppContext } from '../../context/AppContext';
import { useToasts } from '../../context/ToastContext';

interface EditItemModalProps {
  item: Item;
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemToSave: Item | Omit<Item, 'id'>) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}

const EditItemModal: React.FC<EditItemModalProps> = ({ item, isOpen, onClose, onSave, onDelete }) => {
    const { state, actions } = useContext(AppContext);
    const { addToast } = useToasts();
    const [name, setName] = useState('');
    const [unit, setUnit] = useState<Unit>(Unit.PC);
    const [supplierId, setSupplierId] = useState<string>('');
    const [newVariantName, setNewVariantName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(item.name);
            setUnit(item.unit);
            setSupplierId(item.supplierId);
        }
    }, [isOpen, item]);
    
    const isNew = !state.items.some(i => i.id === item.id);

    const handleSave = async () => {
        setIsSaving(true);
        const selectedSupplier = state.suppliers.find(s => s.id === supplierId);
        if (!selectedSupplier) {
            addToast('Invalid supplier selected.', 'error');
            setIsSaving(false);
            return;
        }

        try {
            if (isNew) {
                if (state.items.some(i => i.name.toLowerCase() === name.toLowerCase() && i.supplierId === supplierId)) {
                    addToast(`Item "${name}" from ${selectedSupplier.name} already exists.`, 'error');
                    return;
                }
                await onSave({ name, unit, supplierId, supplierName: selectedSupplier.name });
            } else {
                await onSave({ ...item, name, unit, supplierId, supplierName: selectedSupplier.name });
            }
            onClose();
        } catch (e) {
            // Error toast is handled by the context action
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        setIsSaving(true);
        try {
            await onDelete(item.id);
            onClose();
        } catch(e) {
            // Error toast is handled by the context action
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleAddNewVariant = async () => {
        if (!newVariantName.trim()) {
            addToast('Variant name cannot be empty.', 'error');
            return;
        }

        const parentItem = item;
        const newItemName = `${parentItem.name} (${newVariantName.trim()})`;

        if (state.items.some(i => i.name.toLowerCase() === newItemName.toLowerCase())) {
            addToast(`Item "${newItemName}" already exists.`, 'error');
            return;
        }
        
        setIsSaving(true);
        try {
            await actions.addItem({
                name: newItemName,
                supplierId: parentItem.supplierId,
                supplierName: parentItem.supplierName,
                unit: parentItem.unit,
            });
            setNewVariantName('');
        } catch(e) {
            // Error toast is handled by context
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
            <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h2 className="text-xl font-bold text-white mb-4">{isNew ? 'Add Item' : 'Edit Item'}</h2>
                
                <div className="space-y-4">
                    <div>
                        <label htmlFor="item-name" className="block text-sm font-medium text-gray-300">Item Name</label>
                        <input
                            type="text"
                            id="item-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                     <div>
                        <label htmlFor="item-supplier" className="block text-sm font-medium text-gray-300">Supplier</label>
                        <select
                            id="item-supplier"
                            value={supplierId}
                            onChange={(e) => setSupplierId(e.target.value)}
                            className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        >
                            {state.suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="item-unit" className="block text-sm font-medium text-gray-300">Default Unit</label>
                        <select
                            id="item-unit"
                            value={unit}
                            onChange={(e) => setUnit(e.target.value as Unit)}
                            className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        >
                            {Object.values(Unit).map(u => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {!isNew && (
                    <div className="mt-6 border-t border-gray-700 pt-4">
                        <label htmlFor="variant-name" className="block text-sm font-medium text-gray-300">Variant</label>
                        <div className="flex items-center space-x-2 mt-1">
                            <input
                                type="text"
                                id="variant-name"
                                value={newVariantName}
                                onChange={(e) => setNewVariantName(e.target.value)}
                                className="w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                            />
                            <button onClick={handleAddNewVariant} disabled={isSaving} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-800">Add</button>
                        </div>
                    </div>
                )}

                <div className="mt-6 flex justify-between items-center">
                    <div>
                        {!isNew && (
                            <button
                                onClick={handleDelete}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 text-white disabled:bg-red-800"
                            >
                                {isSaving ? '...' : 'Delete'}
                            </button>
                        )}
                    </div>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-800">
                        {isSaving ? '...' : 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditItemModal;