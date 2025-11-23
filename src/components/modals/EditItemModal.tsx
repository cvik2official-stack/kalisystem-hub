
import React, { useState, useEffect, useContext } from 'react';
import { Item, Unit, SupplierName } from '../../types';
import { AppContext } from '../../context/AppContext';
import { useNotifier } from '../../context/NotificationContext';

interface EditItemModalProps {
  item: Item;
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemToSave: Item | Omit<Item, 'id'>, price?: number) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  initialPrice?: number;
}

const EditItemModal: React.FC<EditItemModalProps> = ({ item, isOpen, onClose, onSave, onDelete, initialPrice }) => {
    const { state, actions } = useContext(AppContext);
    const { notify } = useNotifier();
    const [name, setName] = useState('');
    const [unit, setUnit] = useState<Unit>(Unit.PC);
    const [supplierId, setSupplierId] = useState<string>('');
    const [price, setPrice] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    
    useEffect(() => {
        if (isOpen) {
            setName(item.name);
            setUnit(item.unit);
            setSupplierId(item.supplierId);
            setPrice(initialPrice !== undefined ? initialPrice.toString() : '');
        }
    }, [isOpen, item, initialPrice]);

    const isNew = item.id === 'temp_new_item' || !state.items.some(i => i.id === item.id);

    const handleSupplierChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === '--create-new--') {
            const newSupplierName = prompt("Enter the new supplier's name:");
            if (newSupplierName && newSupplierName.trim()) {
                try {
                    if (state.suppliers.some(s => s.name.toLowerCase() === newSupplierName.trim().toLowerCase())) {
                        notify(`Supplier "${newSupplierName.trim()}" already exists.`, 'error');
                        e.target.value = supplierId;
                        return;
                    }
                    setIsSaving(true);
                    const newSupplier = await actions.addSupplier({
                        name: newSupplierName.trim().toUpperCase() as SupplierName
                    });
                    setSupplierId(newSupplier.id);
                } catch (err) {
                    e.target.value = supplierId;
                } finally {
                    setIsSaving(false);
                }
            } else {
                e.target.value = supplierId;
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
            setIsSaving(false); return;
        }

        try {
            if (isNew && state.items.some(i => i.name.toLowerCase() === name.toLowerCase() && i.supplierId === supplierId)) {
                notify(`Item "${name}" from ${selectedSupplier.name} already exists.`, 'error');
                setIsSaving(false); return;
            }
            
            const itemToSave: Item = { ...item, name, unit, supplierId, supplierName: selectedSupplier.name };
            const priceValue = price.trim() === '' ? undefined : parseFloat(price);
            
            await onSave(itemToSave, priceValue);
            onClose();
        } catch (e) { 
            console.error(e);
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleDelete = async () => {
        if(!confirm("Are you sure you want to delete this item?")) return;
        setIsSaving(true);
        try { await onDelete(item.id); onClose(); } catch(e) { } finally { setIsSaving(false); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <h2 className="text-lg font-bold text-white">{isNew ? 'Create Item' : 'Edit Item'}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 bg-gray-800 rounded-full hover:bg-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="p-6 space-y-6 py-2">
                    <div className="py-2">
                        <label htmlFor="item-name" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Item Name</label>
                        <input
                            type="text"
                            id="item-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            autoFocus={isNew}
                        />
                    </div>
                     <div>
                        <label htmlFor="item-supplier" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Supplier</label>
                        <div className="relative">
                            <select
                                id="item-supplier"
                                value={supplierId}
                                onChange={handleSupplierChange}
                                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                            >
                                {state.suppliers.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                                 <option value="--create-new--">+ Create New Supplier...</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pb-2">
                        <div>
                            <label htmlFor="item-unit" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Unit</label>
                            <div className="relative">
                                <select
                                    id="item-unit"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value as Unit)}
                                    className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                                >
                                    {(Object.values(Unit) as Unit[]).map(u => (
                                        <option key={u} value={u}>{u}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                                    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="item-price" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Default Price</label>
                            <input
                                type="number"
                                id="item-price"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-right font-mono"
                                step="0.01"
                            />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-800/30 border-t border-gray-800 flex justify-between items-center">
                    <div>
                        {!isNew && (
                            <button
                                onClick={handleDelete}
                                disabled={isSaving}
                                className="text-red-500 hover:text-red-400 text-sm font-medium transition-colors flex items-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                            </button>
                        )}
                    </div>
                    <div className="flex space-x-3">
                        <button onClick={onClose} disabled={isSaving} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium transition-colors">Cancel</button>
                        <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 rounded-lg text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400 text-sm font-semibold transition-all">
                            {isSaving ? 'Saving...' : (isNew ? 'Create Item' : 'Save Changes')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditItemModal;
