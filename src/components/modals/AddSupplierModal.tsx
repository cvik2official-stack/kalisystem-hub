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
  const { suppliers, orders, activeStore, activeStatus } = state;

  const filteredSuppliers = useMemo(() => {
    // Get suppliers that do not have an active order in the current view
    const activeSuppliers = new Set(
      orders
        .filter(o => o.store === activeStore && o.status === activeStatus)
        .map(o => o.supplierName)
    );

    const availableSuppliers = suppliers.filter(s => !activeSuppliers.has(s.name));

    const searchFiltered = !search
      ? availableSuppliers
      : availableSuppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
      
    const prioritySuppliers = ['OUDOM', 'KALI', 'MIKHAIL', 'STOCK'];
      
    return searchFiltered.sort((a, b) => {
      const aIsPriority = prioritySuppliers.includes(a.name);
      const bIsPriority = prioritySuppliers.includes(b.name);

      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      
      // If both are priority or both are not, sort by priority order then alphabetically
      if (aIsPriority && bIsPriority) {
        return prioritySuppliers.indexOf(a.name) - prioritySuppliers.indexOf(b.name);
      }
      
      return a.name.localeCompare(b.name);
    });
  }, [search, suppliers, orders, activeStore, activeStatus]);
  
  const handleSelect = (supplier: Supplier) => {
    onSelect(supplier);
    setSearch(''); // Reset search on select
  };

  const handleAddNewSupplier = () => {
    const newSupplier: Supplier = {
      id: `new_${Date.now()}`,
      // We cast here to create a temporary supplier. It won't be saved to the DB
      // but allows for on-the-fly order creation.
      name: search.trim().toUpperCase() as SupplierName,
    };
    onSelect(newSupplier);
    setSearch('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md flex flex-col border-t-4 border-blue-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
        
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
            </div>
            <input
                type="text"
                id="add-supplier-search-input"
                name="add-supplier-search-input"
                placeholder="Search suppliers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full bg-gray-900 text-gray-200 rounded-md p-3 pl-10 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
            />
        </div>

        <div className="mt-4 flex-grow overflow-y-auto -mx-1 px-1" style={{maxHeight: '60vh'}}>
            {filteredSuppliers.length > 0 ? (
                <div className="space-y-1">
                    {filteredSuppliers.map(supplier => (
                        <button 
                            key={supplier.id} 
                            onClick={() => handleSelect(supplier)} 
                            className="w-full text-left p-3 rounded-md hover:bg-indigo-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                        >
                            <p className="font-medium text-white">{supplier.name}</p>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="mt-4 text-gray-500">
                      {search.trim()
                          ? `No suppliers match "${search}".`
                          : (state.suppliers.length > 0 ? "All suppliers have active orders." : "No suppliers configured.")
                      }
                    </p>
                    {search.trim() && (
                      <button
                        onClick={handleAddNewSupplier}
                        className="mt-4 px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                          + Add "{search.trim()}"
                      </button>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AddSupplierModal;