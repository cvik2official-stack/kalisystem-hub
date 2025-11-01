

import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { Item, Unit } from '../../types';
import EditItemModal from '../modals/EditItemModal';

const ItemsSettings: React.FC = () => {
  const { state, actions } = useContext(AppContext);
  
  const [isItemModalOpen, setItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());

  const handleEditItem = (item: Item) => {
    setSelectedItem(item);
    setItemModalOpen(true);
  };

  const handleSaveItem = async (item: Item | Omit<Item, 'id'>) => {
    if ('id' in item && item.id.startsWith('new_')) {
        const { id, ...newItem } = item;
        await actions.addItem(newItem);
    } else {
        await actions.updateItem(item as Item);
    }
  };
  
  const handleDeleteItem = async (itemId: string) => {
    await actions.deleteItem(itemId);
  };

  const handleAddNewItem = () => {
    const defaultSupplier = state.suppliers[0];
    if (!defaultSupplier) {
        // This should not happen if DB is seeded correctly.
        alert('No suppliers found in the database.');
        return;
    }
    setSelectedItem({ 
        id: `new_${Date.now()}`, 
        name: '', 
        supplierId: defaultSupplier.id,
        supplierName: defaultSupplier.name,
        unit: Unit.PC 
    });
    setItemModalOpen(true);
  };

  const filteredItems = useMemo(() => {
    const sortedItems = [...state.items].sort((a, b) => a.name.localeCompare(b.name));
    if (!searchTerm.trim()) {
        return sortedItems;
    }
    return sortedItems.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [state.items, searchTerm]);

  // FIX: Refactored item grouping to use a Map, which provides stronger typing for entries.
  // This resolves issues where `items` was being treated as `unknown` when using Object.entries.
  const groupedItems = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const item of filteredItems) {
        const supplier = item.supplierName;
        if (!groups.has(supplier)) {
            groups.set(supplier, []);
        }
        // Using non-null assertion as we ensure the key exists just before.
        groups.get(supplier)!.push(item);
    }
    return groups;
  }, [filteredItems]);

  const toggleSupplierExpansion = (supplierName: string) => {
    setExpandedSuppliers(prev => {
        const newSet = new Set(prev);
        if (newSet.has(supplierName)) {
            newSet.delete(supplierName);
        } else {
            newSet.add(supplierName);
        }
        return newSet;
    });
  };

  return (
    <div className="flex flex-col flex-grow">
      <div className="flex justify-between items-center mb-4 w-full">
        <input
            type="text"
            id="item-settings-search-input"
            name="item-settings-search-input"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleAddNewItem}
            className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"
            aria-label="Add New Item"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <button 
            onClick={() => setViewMode(viewMode === 'list' ? 'grouped' : 'list')}
            className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"
            aria-label="Switch view mode"
          >
            {viewMode === 'list' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v2m14 0H5" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col w-full">
        {viewMode === 'list' ? (
           <div className="flex-grow overflow-y-auto hide-scrollbar">
              <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                  <tr>
                  <th className="pr-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Supplier</th>
                  <th className="pl-2 pr-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-700/50">
                      <td className="pr-2 py-2 text-white text-sm whitespace-nowrap truncate max-w-[150px] md:max-w-xs">{item.name}</td>
                      <td className="px-2 py-2 text-gray-300 text-sm whitespace-nowrap">{item.supplierName}</td>
                      <td className="pl-2 pr-4 py-2">
                        <div className="flex items-center justify-end space-x-2">
                          <button onClick={() => handleEditItem(item)} className="p-1 rounded-full text-indigo-400 hover:bg-indigo-600 hover:text-white" aria-label="Edit item">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                              <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </td>
                  </tr>
                  ))}
              </tbody>
              </table>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto hide-scrollbar p-2 space-y-2">
            {Array.from(groupedItems.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([supplierName, items]) => (
              <div key={supplierName} className="bg-gray-900/50 rounded-lg">
                  <button 
                      onClick={() => toggleSupplierExpansion(supplierName)}
                      className="w-full flex justify-between items-center p-3 text-left font-semibold text-white"
                  >
                      <span>{supplierName} ({items.length})</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-400 ${expandedSuppliers.has(supplierName) ? '' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                  </button>
                  {expandedSuppliers.has(supplierName) && (
                      <div className="px-3 pb-3">
                          <ul className="divide-y divide-gray-700">
                              {items.map(item => (
                                  <li key={item.id} className="flex justify-between items-center py-2">
                                      <span className="text-white text-sm truncate">{item.name}</span>
                                      <div className="flex items-center space-x-2">
                                          <button onClick={() => handleEditItem(item)} className="p-1 rounded-full text-indigo-400 hover:bg-indigo-600 hover:text-white" aria-label="Edit item">
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                          </button>
                                      </div>
                                  </li>
                              ))}
                          </ul>
                      </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedItem && isItemModalOpen && (
        <EditItemModal 
            item={selectedItem} 
            isOpen={isItemModalOpen} 
            onClose={() => setItemModalOpen(false)} 
            onSave={handleSaveItem}
            onDelete={handleDeleteItem}
        />
      )}
    </div>
  );
};

export default ItemsSettings;