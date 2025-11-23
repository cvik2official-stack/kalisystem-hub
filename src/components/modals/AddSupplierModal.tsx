
import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { Supplier, SupplierName } from '../../types';

interface AddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (supplier: Supplier) => void;
  title: string;
}

const AddSupplierModal: React.FC<AddSupplierModalProps> = ({ isOpen, onClose, onSelect, title }) => {
  const { state } = useContext(AppContext);
  const [search, setSearch] = useState('');
  const { suppliers } = state;

  const filteredSuppliers = useMemo(() => {
    const availableSuppliers: Supplier[] = suppliers;
    const searchFiltered = !search
      ? availableSuppliers
      : availableSuppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
      
    const prioritySuppliers = ['KALI', 'STOCK'];
      
    return searchFiltered.sort((a, b) => {
      const aIsPriority = prioritySuppliers.includes(a.name);
      const bIsPriority = prioritySuppliers.includes(b.name);
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      if (aIsPriority && bIsPriority) return prioritySuppliers.indexOf(a.name) - prioritySuppliers.indexOf(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [search, suppliers]);
  
  const handleSelect = (supplier: Supplier) => {
    onSelect(supplier);
    setSearch('');
  };

  const handleAddNewSupplier = () => {
    const newSupplier: Supplier = {
      id: `new_${Date.now()}`,
      name: search.trim().toUpperCase() as SupplierName,
    };
    onSelect(newSupplier);
    setSearch('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        
        <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 bg-gray-800 rounded-full hover:bg-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        
        <div className="p-4 space-y-4 flex-grow flex flex-col min-h-0">
            <div className="relative flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                </div>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                    className="w-full bg-gray-800 text-white rounded-xl py-3 pl-10 pr-4 outline-none border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-500"
                    placeholder="Search suppliers..."
                />
            </div>

            <div className="flex-grow overflow-y-auto space-y-1 pr-1 hide-scrollbar">
                {filteredSuppliers.length > 0 ? (
                    filteredSuppliers.map(supplier => (
                        <button 
                            key={supplier.id} 
                            onClick={() => handleSelect(supplier)} 
                            className="w-full text-left p-3 rounded-xl hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-all group"
                        >
                            <p className="font-medium text-gray-200 group-hover:text-white">{supplier.name}</p>
                        </button>
                    ))
                ) : (
                    <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <p className="mt-4 text-gray-500 text-sm">
                          {search.trim() ? `No suppliers match "${search}".` : "No suppliers."}
                        </p>
                        {search.trim() && (
                          <button
                            onClick={handleAddNewSupplier}
                            className="mt-4 px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 transition-all"
                          >
                              + Add "{search.trim()}"
                          </button>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AddSupplierModal;
