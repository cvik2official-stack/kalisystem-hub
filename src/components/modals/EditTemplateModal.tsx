import React, { useState, useEffect, useContext } from 'react';
import { Supplier, SupplierName } from '../../types';
import { AppContext } from '../../context/AppContext';

interface EditTemplateModalProps {
  supplier: Supplier;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSupplier: Supplier) => void;
}

const EditTemplateModal: React.FC<EditTemplateModalProps> = ({ supplier, isOpen, onClose, onSave }) => {
    const { state } = useContext(AppContext);
    const [template, setTemplate] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const defaultTemplate = state.settings.messageTemplates?.[`${supplier.name.toLowerCase()}Order`] || state.settings.messageTemplates?.defaultOrder || '';

    useEffect(() => {
        if (isOpen) {
            setTemplate(supplier.botSettings?.messageTemplate || '');
        }
    }, [isOpen, supplier]);

    const handleSave = () => {
        setIsSaving(true);
        const updatedSupplier: Supplier = {
            ...supplier,
            botSettings: {
                ...supplier.botSettings,
                messageTemplate: template.trim() ? template.trim() : undefined, // Store undefined if empty to use default
            }
        };
        onSave(updatedSupplier);
        setIsSaving(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-[60] p-4 pt-16 md:pt-4" onClick={onClose}>
            <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h2 className="text-xl font-bold text-white mb-2">Edit Message Template</h2>
                <p className="text-sm text-gray-400 mb-4">for <span className="font-semibold text-gray-300">{supplier.name}</span></p>

                <textarea
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    rows={8}
                    className="w-full bg-gray-900 text-gray-200 rounded-md p-3 font-mono text-xs outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                />
                 <div className="text-xs text-gray-500 mt-2">
                    Leave blank to use the default template. Placeholders: <code>{'{{storeName}}'}</code>, <code>{'{{orderId}}'}</code>, <code>{'{{items}}'}</code>.
                </div>
                
                <div className="mt-4 p-3 bg-gray-900/50 rounded-md">
                    <h4 className="text-xs font-semibold text-gray-400 mb-1">Default Template for this Supplier:</h4>
                    <pre className="text-xs text-gray-500 whitespace-pre-wrap font-mono">{defaultTemplate}</pre>
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={handleSave} disabled={isSaving} className="px-5 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white">
                        {isSaving ? '...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditTemplateModal;
