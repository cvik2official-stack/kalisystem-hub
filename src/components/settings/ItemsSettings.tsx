import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { Item, Unit, SupplierName } from '../../types';
import { useNotifier } from '../../context/NotificationContext';

const ItemsSettings: React.FC = () => {
  const { state, actions } = useContext(AppContext);
  const { notify } = useNotifier();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [editedItems, setEditedItems] = useState<Record<string, Partial<Item>>>({});
  const [newItems, setNewItems] = useState<Partial<Item>[]>([]);
  const [editedPrices, setEditedPrices] = useState<Record<string, { price: number }>>({});
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = useMemo(() => Object.keys(editedItems).length > 0 || newItems.some(item => item.name && item.supplierId) || Object.keys(editedPrices).length > 0, [editedItems, newItems, editedPrices]);

  const handleItemChange = (id: string, field: keyof Item, value: any) => {
    setEditedItems(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleNewItemChange = (index: number, field: keyof Item, value: any) => {
    setNewItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handlePriceChange = (id: string, value: string) => {
    const price = parseFloat(value);
    setEditedPrices(prev => ({
        ...prev,
        [id]: {
            price: isNaN(price) ? 0 : price,
        }
    }));
  };

  const handleAddNewItem = () => {
    const defaultSupplier = state.suppliers[0];
    if (!defaultSupplier) {
        notify('Please create a supplier first.', 'error');
        return;
    }
    setNewItems(prev => [...prev, { name: '', unit: Unit.PC, supplierId: defaultSupplier.id }]);
  };

  const handleDeleteItem = async (item: Item) => {
    if (window.confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) {
      await actions.deleteItem(item.id);
      setEditedItems(prev => {
        const { [item.id]: _, ...rest } = prev;
        return rest;
      });
      setEditedPrices(prev => {
        const { [item.id]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleDeleteNewItem = (index: number) => {
    setNewItems(prev => prev.filter((_, i) => i !== index));
    setEditedPrices(prev => {
        const key = `new-${index}`;
        const { [key]: _, ...rest } = prev;
        return rest;
    });
  };
  
  const handleDiscardChanges = () => {
    if (window.confirm('Are you sure you want to discard all pending changes?')) {
        setEditedItems({});
        setNewItems([]);
        setEditedPrices({});
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
        // Process item property updates first
        const itemUpdatePromises = Object.keys(editedItems).map(itemId => {
            const originalItem = state.items.find(i => i.id === itemId);
            if (originalItem) {
                const changes = editedItems[itemId];
                const supplier = state.suppliers.find(s => s.id === (changes.supplierId || originalItem.supplierId));
                if (supplier) {
                    return actions.updateItem({ ...originalItem, ...changes, supplierName: supplier.name });
                }
            }
            return Promise.resolve();
        });
        await Promise.all(itemUpdatePromises);

        // Process price updates for existing items
        const priceUpdatePromises = Object.keys(editedPrices).filter(key => !key.startsWith('new-')).map(itemId => {
            const originalItem = state.items.find(i => i.id === itemId)!;
            const currentData = { ...originalItem, ...(editedItems[itemId] || {}) };
            const priceData = editedPrices[itemId];
            const priceToSave = priceData.price > 1000 ? priceData.price / 4000 : priceData.price;

            return actions.upsertItemPrice({
                itemId,
                supplierId: currentData.supplierId,
                price: priceToSave,
                unit: currentData.unit,
                isMaster: true,
            });
        });
        await Promise.all(priceUpdatePromises);

        // Process new items and their prices sequentially
        for (const [index, newItem] of newItems.entries()) {
            const supplier = state.suppliers.find(s => s.id === newItem.supplierId);
            if (newItem.name && supplier) {
                const createdItem = await actions.addItem({
                    name: newItem.name,
                    unit: newItem.unit || Unit.PC,
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    trackStock: newItem.trackStock || false,
                    stockQuantity: newItem.stockQuantity || 0,
                });
                
                const priceData = editedPrices[`new-${index}`];
                if (priceData) {
                    const priceToSave = priceData.price > 1000 ? priceData.price / 4000 : priceData.price;
                    await actions.upsertItemPrice({
                        itemId: createdItem.id,
                        supplierId: createdItem.supplierId,
                        price: priceToSave,
                        unit: createdItem.unit,
                        isMaster: true,
                    });
                }
            }
        }
        
        notify('All changes saved successfully!', 'success');
        setEditedItems({});
        setNewItems([]);
        setEditedPrices({});

    } catch (error) {
        // Error toast is handled by context
    } finally {
        setIsSaving(false);
    }
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
            {hasChanges && (
                 <>
                    <button onClick={handleDiscardChanges} disabled={isSaving} className="px-3 py-2 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-500 text-white">Discard</button>
                    <button onClick={handleSaveAll} disabled={isSaving} className="px-3 py-2 text-sm font-medium rounded-md bg-green-600 hover:bg-green-700 text-white disabled:bg-green-800 disabled:cursor-wait">
                        {isSaving ? 'Saving...' : 'Save All'}
                    </button>
                 </>
            )}
            <button 
              onClick={handleAddNewItem}
              className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"
              aria-label="Add New Item"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
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
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Unit</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Unit Price</th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider" title="Track Stock">Track</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Stock Qty</th>
                    <th className="pl-2 pr-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {filteredItems.map(item => {
                      const currentData = { ...item, ...(editedItems[item.id] || {}) };
                      const masterPrice = state.itemPrices.find(p => p.itemId === item.id && p.isMaster)?.price;
                      const editedPrice = editedPrices[item.id]?.price;
                      const displayPrice = editedPrice !== undefined ? editedPrice : (masterPrice !== undefined ? masterPrice : '');
                      const trackStock = currentData.trackStock || false;
                      
                      return (
                        <tr key={item.id} className={(editedItems[item.id] || editedPrices[item.id]) ? "bg-indigo-900/20" : ""}>
                            <td className="pl-4 pr-2 py-1 text-sm"><input type="text" value={currentData.name} onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500" /></td>
                            <td className="px-2 py-1 text-sm"><select value={currentData.supplierId} onChange={(e) => handleItemChange(item.id, 'supplierId', e.target.value)} className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 border-none">
                                {state.suppliers.map(s => <option key={s.id} value={s.id} className="bg-gray-800 text-white">{s.name}</option>)}
                            </select></td>
                            <td className="px-2 py-1 text-sm"><select value={currentData.unit} onChange={(e) => handleItemChange(item.id, 'unit', e.target.value as Unit)} className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 border-none">
                                {Object.values(Unit).map(u => <option key={u} value={u} className="bg-gray-800 text-white">{u}</option>)}
                            </select></td>
                            <td className="px-2 py-1 text-sm"><input type="number" step="0.01" value={displayPrice} onChange={(e) => handlePriceChange(item.id, e.target.value)} className="bg-transparent p-1 w-24 rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500" /></td>
                            <td className="px-2 py-1 text-center"><input type="checkbox" checked={trackStock} onChange={(e) => handleItemChange(item.id, 'trackStock', e.target.checked)} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" /></td>
                            <td className="px-2 py-1 text-sm"><input type="number" value={trackStock ? currentData.stockQuantity ?? '' : ''} onChange={(e) => handleItemChange(item.id, 'stockQuantity', parseInt(e.target.value) || 0)} disabled={!trackStock} className="bg-transparent p-1 w-20 rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 disabled:text-gray-600" /></td>
                            <td className="pl-2 pr-4 py-1 text-right">
                               <div className="flex items-center justify-end space-x-2">
                                  <button onClick={() => actions.addItemToDispatch(item)} className="p-1 rounded-full text-gray-400 hover:bg-gray-600 hover:text-white" aria-label="Add to Dispatch"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                                  <button onClick={() => handleDeleteItem(item)} className="p-1 rounded-full text-red-500 hover:bg-red-600 hover:text-white" aria-label="Delete Item"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                               </div>
                            </td>
                        </tr>
                    )}
                  )}
                  {newItems.map((item, index) => {
                       const key = `new-${index}`;
                       const trackStock = item.trackStock || false;
                       const editedPrice = editedPrices[key]?.price;
                       const displayPrice = editedPrice !== undefined ? editedPrice : '';
                      return (
                         <tr key={key} className="bg-green-900/20">
                            <td className="pl-4 pr-2 py-1 text-sm"><input type="text" value={item.name || ''} onChange={(e) => handleNewItemChange(index, 'name', e.target.value)} className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500" /></td>
                            <td className="px-2 py-1 text-sm"><select value={item.supplierId} onChange={(e) => handleNewItemChange(index, 'supplierId', e.target.value)} className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 border-none">
                                {state.suppliers.map(s => <option key={s.id} value={s.id} className="bg-gray-800 text-white">{s.name}</option>)}
                            </select></td>
                            <td className="px-2 py-1 text-sm"><select value={item.unit} onChange={(e) => handleNewItemChange(index, 'unit', e.target.value as Unit)} className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 border-none">
                                {Object.values(Unit).map(u => <option key={u} value={u} className="bg-gray-800 text-white">{u}</option>)}
                            </select></td>
                            <td className="px-2 py-1 text-sm"><input type="number" step="0.01" value={displayPrice} onChange={(e) => handlePriceChange(key, e.target.value)} className="bg-transparent p-1 w-24 rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500" /></td>
                            <td className="px-2 py-1 text-center"><input type="checkbox" checked={trackStock} onChange={(e) => handleNewItemChange(index, 'trackStock', e.target.checked)} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" /></td>
                            <td className="px-2 py-1 text-sm"><input type="number" value={trackStock ? item.stockQuantity ?? '' : ''} onChange={(e) => handleNewItemChange(index, 'stockQuantity', parseInt(e.target.value) || 0)} disabled={!trackStock} className="bg-transparent p-1 w-20 rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 disabled:text-gray-600" /></td>
                            <td className="pl-2 pr-4 py-1 text-right">
                               <button onClick={() => handleDeleteNewItem(index)} className="p-1 rounded-full text-red-500 hover:bg-red-600 hover:text-white" aria-label="Delete new item row"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                            </td>
                        </tr>
                      )
                  })}
              </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default ItemsSettings;