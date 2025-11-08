import React, { useContext, useState, useMemo, useRef } from 'react';
import { AppContext } from '../../context/AppContext';
import { Item, Unit, SupplierName } from '../../types';
import { useNotifier } from '../../context/NotificationContext';

const ItemsSettings: React.FC = () => {
  const { state, actions } = useContext(AppContext);
  const { notify } = useNotifier();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleAddNewItem = async () => {
    const defaultSupplier = state.suppliers.find(s => s.name === SupplierName.MARKET) || state.suppliers[0];
    if (!defaultSupplier) {
        notify('Please create a supplier first.', 'error');
        return;
    }
    setIsCreating(true);
    try {
        await actions.addItem({
            name: 'New Item',
            unit: Unit.PC,
            supplierId: defaultSupplier.id,
            supplierName: defaultSupplier.name,
        });
        notify('New item added. You can now edit its details.', 'success');
    } finally {
        setIsCreating(false);
    }
  };

  const handleDeleteItem = async (item: Item) => {
    await actions.deleteItem(item.id);
  };

  const handleItemUpdate = async (item: Item, field: keyof Item, value: any) => {
      const supplier = state.suppliers.find(s => s.id === (field === 'supplierId' ? value : item.supplierId));
      if (!supplier) return;
      
      const updatedItem: Item = {
          ...item,
          [field]: value,
          supplierName: supplier.name, // Ensure supplierName is in sync
      };
      await actions.updateItem(updatedItem);
  };
  
  const handlePriceUpdate = async (item: Item, priceStr: string) => {
      const price = parseFloat(priceStr);
      if (isNaN(price)) return;
      const priceToSave = price > 1000 ? price / 4000 : price;
      
      await actions.upsertItemPrice({
          itemId: item.id,
          supplierId: item.supplierId,
          price: priceToSave,
          unit: item.unit,
          isMaster: true,
      });
  };


  const filteredItems = useMemo(() => {
    const sortedItems = [...state.items].sort((a, b) => {
        // Show newly created "New Item" at the top
        if (a.name === 'New Item' && b.name !== 'New Item') return -1;
        if (b.name === 'New Item' && a.name !== 'New Item') return 1;
        return a.name.localeCompare(b.name)
    });
    if (!searchTerm.trim()) {
        return sortedItems;
    }
    return sortedItems.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [state.items, searchTerm]);

  return (
    <div className="flex flex-col flex-grow">
      <div className="flex justify-between items-center mb-4 w-full gap-4">
        <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <div className="flex items-center gap-2">
            <button 
              onClick={handleAddNewItem}
              disabled={isCreating}
              className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 disabled:cursor-wait"
              aria-label="Add New Item"
            >
              {isCreating 
                ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              }
            </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col w-full">
           <div className="flex-grow overflow-y-auto hide-scrollbar">
              <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800 sticky top-0 z-10">
                  <tr>
                    <th className="pl-4 pr-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-1/3">Name</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Supplier</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-24">Unit</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-20">Unit Price</th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider" title="Track Stock">Track</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-20">Stock Qty</th>
                    <th className="pl-2 pr-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {filteredItems.map(item => {
                      const masterPrice = state.itemPrices.find(p => p.itemId === item.id && p.isMaster)?.price;
                      
                      return (
                        <tr key={item.id} className="hover:bg-gray-700/50">
                            <td className="pl-4 pr-2 py-1 text-sm"><input type="text" defaultValue={item.name} onBlur={(e) => handleItemUpdate(item, 'name', e.target.value)} className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500" /></td>
                            <td className="px-2 py-1 text-sm"><select defaultValue={item.supplierId} onChange={(e) => handleItemUpdate(item, 'supplierId', e.target.value)} className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 border-none">
                                {state.suppliers.map(s => <option key={s.id} value={s.id} className="bg-gray-800 text-white">{s.name}</option>)}
                            </select></td>
                            <td className="px-2 py-1 text-sm"><select defaultValue={item.unit} onChange={(e) => handleItemUpdate(item, 'unit', e.target.value as Unit)} className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 border-none">
                                {/* FIX: Cast enum values to an array of Unit to ensure proper type inference. */}
                                {(Object.values(Unit) as Unit[]).map(u => <option key={u} value={u} className="bg-gray-800 text-white">{u}</option>)}
                            </select></td>
                            <td className="px-2 py-1 text-sm"><input type="number" step="0.01" defaultValue={masterPrice} onBlur={(e) => handlePriceUpdate(item, e.target.value)} className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500" /></td>
                            <td className="px-2 py-1 text-center"><input type="checkbox" defaultChecked={item.trackStock} onChange={(e) => handleItemUpdate(item, 'trackStock', e.target.checked)} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" /></td>
                            <td className="px-2 py-1 text-sm"><input type="number" defaultValue={item.stockQuantity} onBlur={(e) => handleItemUpdate(item, 'stockQuantity', parseInt(e.target.value) || 0)} disabled={!item.trackStock} className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 disabled:text-gray-600" /></td>
                            <td className="pl-2 pr-4 py-1 text-right">
                               <div className="flex items-center justify-end space-x-2">
                                  <button onClick={() => actions.addItemToDispatch(item)} className="p-1 rounded-full text-gray-400 hover:bg-gray-600 hover:text-white" aria-label="Add to Dispatch"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                                  <button onClick={() => handleDeleteItem(item)} className="p-1 rounded-full text-red-500 hover:bg-red-600 hover:text-white" aria-label="Delete Item"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                               </div>
                            </td>
                        </tr>
                    )}
                  )}
              </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default ItemsSettings;