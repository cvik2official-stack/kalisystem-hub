import React, { useState, useEffect, useContext } from 'react';
import { Item, Unit, SupplierName } from '../../types';
import { AppContext } from '../../context/AppContext';
import { useNotifier } from '../../context/NotificationContext';

interface EditItemModalProps {
  item: Item;
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemToSave: Item | Omit<Item, 'id'>) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}

const EditItemModal: React.FC<EditItemModalProps> = ({ item, isOpen, onClose, onSave, onDelete }) => {
    const { state, actions } = useContext(AppContext);
    const { notify } = useNotifier();
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

    const handleSupplierChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === '--create-new--') {
            const newSupplierName = prompt("Enter the new supplier's name:");
            if (newSupplierName && newSupplierName.trim()) {
                try {
                    if (state.suppliers.some(s => s.name.toLowerCase() === newSupplierName.trim().toLowerCase())) {
                        notify(`Supplier "${newSupplierName.trim()}" already exists.`, 'error');
                        e.target.value = supplierId; // Reset dropdown to original value
                        return;
                    }
                    setIsSaving(true);
                    const newSupplier = await actions.addSupplier({
                        name: newSupplierName.trim().toUpperCase() as SupplierName
                    });
                    setSupplierId(newSupplier.id);
                } catch (err) {
                    e.target.value = supplierId; // Reset on failure
                } finally {
                    setIsSaving(false);
                }
            } else {
                e.target.value = supplierId; // Reset if user cancels or enters empty name
            }
        } else {
            setSupplierId(value);
        }
    };


    const handleSave = async () => {
        setIsSaving(true);
        const selectedSupplier = state.suppliers.find(s => s.id === supplierId);
        if (!selectedSupplier) {
            notify('Invalid supplier selected.', 'error');
            setIsSaving(false);
            return;
        }

        try {
            if (isNew && state.items.some(i => i.name.toLowerCase() === name.toLowerCase() && i.supplierId === supplierId)) {
                notify(`Item "${name}" from ${selectedSupplier.name} already exists.`, 'error');
                setIsSaving(false);
                return;
            }
            
            const itemToSave: Item = {
                ...item,
                name,
                unit,
                supplierId,
                supplierName: selectedSupplier.name
            };

            await onSave(itemToSave);
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
            notify('Variant name cannot be empty.', 'error');
            return;
        }

        const parentItem = item;
        const newItemName = `${parentItem.name} (${newVariantName.trim()})`;

        if (state.items.some(i => i.name.toLowerCase() === newItemName.toLowerCase())) {
            notify(`Item "${newItemName}" already exists.`, 'error');
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
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
            <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
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
                            name="item-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                     <div>
                        <label htmlFor="item-supplier" className="block text-sm font-medium text-gray-300">Supplier</label>
                        <select
                            id="item-supplier"
                            name="item-supplier"
                            value={supplierId}
                            onChange={handleSupplierChange}
                            className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        >
                            {state.suppliers.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                             <option value="--create-new--" className="text-indigo-400 font-semibold">
                                + Create New Supplier...
                            </option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="item-unit" className="block text-sm font-medium text-gray-300">Default Unit</label>
                        <select
                            id="item-unit"
                            name="item-unit"
                            value={unit}
                            onChange={(e) => setUnit(e.target.value as Unit)}
                            className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        >
                            {/* FIX: Cast enum value to string for key property */}
                            {Object.values(Unit).map(u => (
                                <option key={u as string} value={u}>{u}</option>
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
                                name="variant-name"
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