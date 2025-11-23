import React, { useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { AppContext } from '../../context/AppContext';
import { Item, Unit, SupplierName, Supplier, ItemPrice } from '../../types';
import { useNotifier } from '../../context/NotificationContext';
import EditItemModal from '../modals/EditItemModal';
import { getLatestItemPrice } from '../../utils/messageFormatter';

interface ItemsSettingsProps {
    setMenuOptions: (options: any[]) => void;
}

// Map specific tags to specific styles
const SPECIAL_TAG_COLORS: Record<string, string> = {
    'KALI': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'CV2': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'WB': 'bg-green-500/20 text-green-300 border-green-500/30',
    'SHANTI': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'STI': 'bg-blue-500/20 text-blue-300 border-blue-500/30', // Alias for SHANTI
    'STOCKO2': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'O2': 'bg-orange-500/20 text-orange-300 border-orange-500/30', // Alias for STOCKO2
    'new': 'bg-lime-500/20 text-lime-300 border-lime-500/30',
    'stock': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const TAG_COLORS = [
    'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'bg-pink-500/20 text-pink-300 border-pink-500/30',
    'bg-teal-500/20 text-teal-300 border-teal-500/30',
    'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    'bg-red-500/20 text-red-300 border-red-500/30',
];

const stringToColorClass = (str: string) => {
    // Check for explicit colors first (case-insensitive check for keys)
    const upperStr = str.toUpperCase();
    
    // Direct matches for proper casing or lowercase "new"/"stock"
    if (SPECIAL_TAG_COLORS[str]) return SPECIAL_TAG_COLORS[str];
    
    // Case-insensitive fallback for known store tags
    const keys = Object.keys(SPECIAL_TAG_COLORS);
    for (const key of keys) {
        if (key.toUpperCase() === upperStr) return SPECIAL_TAG_COLORS[key];
    }

    // Default hashing for random tags
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % TAG_COLORS.length;
    return TAG_COLORS[index];
};

// --- Sub-components for Cells ---

const ItemNameInput = React.memo(({ value, onUpdate }: { value: string, onUpdate: (val: string) => void }) => (
    <input
        type="text"
        defaultValue={value}
        onBlur={(e) => onUpdate(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="bg-transparent hover:bg-gray-800 focus:bg-gray-900 text-gray-300 focus:text-white p-1 w-full rounded outline-none transition-colors"
    />
));

const ItemSupplierSelect = React.memo(({ value, suppliers, onUpdate }: { value: string, suppliers: Supplier[], onUpdate: (val: string) => void }) => (
    <select
        defaultValue={value}
        onChange={(e) => onUpdate(e.target.value)}
        className="bg-transparent hover:bg-gray-800 focus:bg-gray-900 text-gray-300 focus:text-white p-1 w-full rounded outline-none transition-colors cursor-pointer"
    >
        {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
        ))}
    </select>
));

const ItemUnitSelect = React.memo(({ value, onUpdate }: { value: Unit, onUpdate: (val: Unit) => void }) => (
    <select
        defaultValue={value}
        onChange={(e) => onUpdate(e.target.value as Unit)}
        className="bg-transparent hover:bg-gray-800 focus:bg-gray-900 text-gray-300 focus:text-white p-1 w-full rounded outline-none transition-colors cursor-pointer"
    >
        {(Object.values(Unit) as Unit[]).map(u => <option key={u} value={u}>{u}</option>)}
    </select>
));

const ItemStockInput = React.memo(({ value, onUpdate }: { value: number | undefined | null, onUpdate: (val: string) => void }) => (
    <input
        type="text"
        inputMode="decimal"
        defaultValue={value != null ? value : ''}
        onBlur={(e) => onUpdate(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        placeholder="-"
        className="bg-transparent hover:bg-gray-800 focus:bg-gray-900 text-gray-300 focus:text-white p-1 w-full rounded outline-none text-right transition-colors"
    />
));

const ItemPriceInput = React.memo(({ value, onUpdate }: { value: number | undefined, onUpdate: (val: string) => void }) => (
    <input
        type="text"
        inputMode="decimal"
        defaultValue={value != null ? value.toFixed(2) : ''}
        onBlur={(e) => onUpdate(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        placeholder="-"
        className="bg-transparent hover:bg-gray-800 focus:bg-gray-900 text-gray-300 focus:text-white p-1 w-full rounded outline-none text-right transition-colors"
    />
));

const ItemTagsInput = React.memo(({ value, onUpdate }: { value: string[] | undefined, onUpdate: (val: string[]) => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState((value || []).join(', '));

    useEffect(() => {
        if (!isEditing) {
            setLocalValue((value || []).join(', '));
        }
    }, [value, isEditing]);

    const handleBlur = () => {
        const tags = localValue.split(',').map(t => t.trim()).filter(t => t !== '');
        // Only update if changed to avoid unnecessary calls
        const currentTags = value || [];
        const hasChanged = tags.length !== currentTags.length || tags.some((t, i) => t !== currentTags[i]);
        
        if (hasChanged) {
            onUpdate(tags);
        }
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <input
                type="text"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className="bg-gray-900 text-white p-1 w-full rounded outline-none"
                autoFocus
            />
        );
    }

    return (
        <div 
            onClick={() => setIsEditing(true)} 
            className="flex flex-wrap gap-1 cursor-pointer min-h-[28px] items-center hover:bg-gray-800/50 rounded p-1"
        >
            {(value && value.length > 0) ? value.map(tag => (
                <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded border ${stringToColorClass(tag)}`}>
                    {tag}
                </span>
            )) : <span className="text-gray-600 text-xs">-</span>}
        </div>
    );
});


// --- Row Component ---

interface ItemRowProps {
    item: Item;
    suppliers: Supplier[];
    isGrouped: boolean;
    latestPrice?: number;
    onUpdate: (item: Item, field: keyof Item | 'price', value: any) => void;
    onEdit: (item: Item) => void;
    onDelete: (id: string) => void;
}

const ItemRow = React.memo(({ item, suppliers, isGrouped, latestPrice, onUpdate, onEdit, onDelete }: ItemRowProps) => {
    return (
        <tr className="hover:bg-gray-700/50">
            {isGrouped && (
                <td className="px-1 py-2 whitespace-nowrap text-sm text-gray-300 w-[40px]">
                    {/* Drag handle placeholder */}
                </td>
            )}
            <td className="px-1 py-1 whitespace-nowrap text-sm text-gray-300 w-[250px]">
                <ItemNameInput value={item.name} onUpdate={(val) => onUpdate(item, 'name', val)} />
            </td>
            {!isGrouped && (
                <td className="px-1 py-1 whitespace-nowrap text-sm text-gray-300 w-[120px]">
                    <ItemSupplierSelect value={item.supplierId} suppliers={suppliers} onUpdate={(val) => onUpdate(item, 'supplierId', val)} />
                </td>
            )}
            <td className="px-1 py-1 whitespace-nowrap text-sm text-gray-300 w-[70px]">
                <ItemUnitSelect value={item.unit} onUpdate={(val) => onUpdate(item, 'unit', val)} />
            </td>
            <td className="px-1 py-1 whitespace-nowrap text-sm text-gray-300 w-[80px]">
                <ItemStockInput value={item.stockQuantity} onUpdate={(val) => onUpdate(item, 'stockQuantity', val)} />
            </td>
            <td className="px-1 py-1 whitespace-nowrap text-sm text-gray-300 w-[80px]">
                <ItemPriceInput value={latestPrice} onUpdate={(val) => onUpdate(item, 'price', val)} />
            </td>
            <td className="px-1 py-1 text-sm text-gray-300 w-[150px]">
                <ItemTagsInput value={item.tags} onUpdate={(val) => onUpdate(item, 'tags', val)} />
            </td>
            <td className="px-1 py-1 whitespace-nowrap text-sm text-gray-300 w-[80px]">
                <div className="flex items-center justify-end space-x-2">
                    <button onClick={() => onEdit(item)} className="p-1 rounded-full text-indigo-400 hover:bg-indigo-600 hover:text-white" aria-label="Edit Item">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <button onClick={() => onDelete(item.id)} className="p-1 rounded-full text-red-500 hover:bg-red-600 hover:text-white" aria-label="Delete Item">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </td>
        </tr>
    );
});

// --- Main Component ---

const ItemsSettings: React.FC<ItemsSettingsProps> = ({ setMenuOptions }) => {
  const { state, actions } = useContext(AppContext);
  const { notify } = useNotifier();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState<Item | null>(null);
  const [isGrouped, setIsGrouped] = useState(false);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  // Memoize sorted suppliers for dropdowns
  const sortedSuppliers = useMemo(() => {
      return [...state.suppliers].sort((a, b) => a.name.localeCompare(b.name));
  }, [state.suppliers]);
  
  const allTags = useMemo(() => {
      const tags = new Set<string>();
      state.items.forEach(item => {
          item.tags?.forEach(tag => tags.add(tag));
      });
      return Array.from(tags).sort();
  }, [state.items]);

  const toggleTagFilter = (tag: string) => {
      setActiveTags(prev => {
          const newSet = new Set(prev);
          if (newSet.has(tag)) newSet.delete(tag);
          else newSet.add(tag);
          return newSet;
      });
  };

  const filteredItems = useMemo(() => {
    const sortedItems = [...state.items].sort((a, b) => a.name.localeCompare(b.name));
    
    let filtered = sortedItems;

    if (activeTags.size > 0) {
        filtered = filtered.filter(item => 
            item.tags && item.tags.some(tag => activeTags.has(tag))
        );
    }

    if (searchTerm.trim()) {
        const lowerTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(item => 
          item.name.toLowerCase().includes(lowerTerm) ||
          item.supplierName.toLowerCase().includes(lowerTerm)
        );
    }
    
    return filtered;
  }, [state.items, searchTerm, activeTags]);

  const groupedItems = useMemo(() => {
    if (!isGrouped) return null;

    const itemsToGroup = [...filteredItems].sort((a,b) => a.supplierName.localeCompare(b.supplierName) || a.name.localeCompare(b.name));

    return itemsToGroup.reduce((acc, item) => {
        const { supplierName } = item;
        if (!acc[supplierName]) {
            acc[supplierName] = [];
        }
        acc[supplierName].push(item);
        return acc;
    }, {} as Record<string, Item[]>);
  }, [isGrouped, filteredItems]);

  // Handlers
  const handleItemUpdate = useCallback(async (item: Item, field: keyof Item | 'price', value: any) => {
    if (field === 'price') {
        let newPrice = typeof value === 'string' && value.trim() === '' ? 0 : parseFloat(value);
        const latestPrice = getLatestItemPrice(item.id, item.supplierId, state.itemPrices)?.price;
        
        if (newPrice > 1000) newPrice = newPrice / 4000;
        if (latestPrice === newPrice) return;

        if (!isNaN(newPrice) && newPrice >= 0) {
            await actions.upsertItemPrice({ itemId: item.id, supplierId: item.supplierId, price: newPrice, unit: item.unit });
        } else {
            notify('Invalid price.', 'error');
        }
        return;
    }

    if (field === 'stockQuantity') {
        const newQty = typeof value === 'string' && value.trim() === '' ? null : parseFloat(value);
        if (item.stockQuantity === newQty) return;
        // Allow null (empty string) or valid number
        if (newQty === null || !isNaN(newQty)) {
            await actions.updateItem({ ...item, stockQuantity: newQty });
        } else {
            notify('Invalid stock quantity.', 'error');
        }
        return;
    }
    
    if (field === 'tags') {
        await actions.updateItem({ ...item, tags: value });
        return;
    }

    // Standard Item Fields
    if (String(item[field as keyof Item] ?? '') === String(value)) return;

    let finalName = field === 'name' ? String(value).trim() : item.name;
    const finalSupplierId = field === 'supplierId' ? value : item.supplierId;

    if (field === 'name') {
        if (!finalName) {
            notify('Item name cannot be empty.', 'error');
            return;
        }
        // Capitalize first letter of first word
        finalName = finalName.charAt(0).toUpperCase() + finalName.slice(1);
    }
    
    // Duplicate check
    const duplicateExists = state.items.some(i =>
        i.id !== item.id &&
        i.name.toLowerCase() === finalName.toLowerCase() &&
        i.supplierId === finalSupplierId
    );

    if (duplicateExists) {
        const supplierName = state.suppliers.find(s => s.id === finalSupplierId)?.name || 'this supplier';
        notify(`An item named "${finalName}" from ${supplierName} already exists.`, 'error');
        return;
    }

    let itemToUpdate = { ...item, [field]: value };
    if (field === 'name') itemToUpdate.name = finalName;
    if (field === 'supplierId') {
      const newSupplier = state.suppliers.find(s => s.id === value);
      if (newSupplier) itemToUpdate.supplierName = newSupplier.name;
    }

    await actions.updateItem(itemToUpdate);
  }, [state.items, state.suppliers, state.itemPrices, actions, notify]);


  const handleAddNewItem = useCallback(async () => {
    const defaultSupplier = state.suppliers.find(s => s.name === SupplierName.MARKET) || state.suppliers[0];
    if (!defaultSupplier) {
        notify('Please create a supplier first.', 'error');
        return;
    }
    setIsCreating(true);
    try {
        const newItem = await actions.addItem({
            name: 'New Item',
            unit: Unit.PC,
            supplierId: defaultSupplier.id,
            supplierName: defaultSupplier.name,
        });
        notify('New item added. You can now edit its details.', 'success');
        setSelectedItemForModal(newItem);
        setIsEditModalOpen(true);
    } finally {
        setIsCreating(false);
    }
  }, [state.suppliers, actions, notify]);

  const handleDeleteItem = useCallback(async (itemId: string) => {
    await actions.deleteItem(itemId);
  }, [actions]);
  
  const handleEditClick = useCallback((item: Item) => {
    setSelectedItemForModal(item);
    setIsEditModalOpen(true);
  }, []);

  const toggleGroup = (supplierName: string) => {
      setExpandedGroups(prev => {
          const newSet = new Set(prev);
          if (newSet.has(supplierName)) newSet.delete(supplierName);
          else newSet.add(supplierName);
          return newSet;
      });
  };
    
  const handleExportItemsCsv = useCallback(() => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["Name", "Supplier", "Unit", "Stock Qty", "Price", "Tags"];
    csvContent += headers.join(",") + "\r\n";

    filteredItems.forEach(item => {
        const price = getLatestItemPrice(item.id, item.supplierId, state.itemPrices)?.price ?? '';
        const row = [
            `"${item.name.replace(/"/g, '""')}"`,
            item.supplierName,
            item.unit,
            item.stockQuantity ?? '',
            price,
            `"${(item.tags || []).join(', ')}"`
        ];
        csvContent += row.join(",") + "\r\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "items_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Items exported to CSV.', 'success');
  }, [filteredItems, state.itemPrices, notify]);

  // Clear menu options on unmount
  useEffect(() => {
    return () => setMenuOptions([]);
  }, [setMenuOptions]);

  return (
    <div className="flex flex-col flex-grow w-full lg:w-3/4">
        {/* Filter Bar */}
        <div className="mb-4 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
                 <div className="flex items-center space-x-2 flex-grow">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full max-w-xs bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2 outline-none text-sm focus:border-indigo-500 transition-colors"
                        placeholder="Search items..."
                    />
                     <button onClick={handleAddNewItem} className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors" title="Add New Item">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                     </button>
                     <button onClick={handleExportItemsCsv} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-colors" title="Export to CSV">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                     </button>
                     <button onClick={() => setIsGrouped(!isGrouped)} className={`p-2 rounded-md transition-colors ${isGrouped ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`} title={isGrouped ? "Ungroup" : "Group by Supplier"}>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                     </button>
                 </div>
            </div>

            {allTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {allTags.map(tag => (
                        <button
                            key={tag}
                            onClick={() => toggleTagFilter(tag)}
                            className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors border ${
                                activeTags.has(tag) 
                                ? stringToColorClass(tag) + ' ring-1 ring-white'
                                : stringToColorClass(tag) + ' opacity-70 hover:opacity-100'
                            }`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            )}
        </div>

      <div className="overflow-x-auto hide-scrollbar">
          <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                  <tr>
                      {isGrouped && <th scope="col" className="w-[40px]"></th>}
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[250px]">Name</th>
                      {!isGrouped && <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[120px]">Supplier</th>}
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[70px]">Unit</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[80px]">Stock</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[80px]">Price</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[150px]">Tags</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[80px]">Actions</th>
                  </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {isGrouped && groupedItems ? (
                      Object.keys(groupedItems).map(supplierName => {
                        const isExpanded = expandedGroups.has(supplierName);
                        return (
                          <React.Fragment key={supplierName}>
                              <tr className="bg-gray-700/50">
                                  <td colSpan={7} className="px-3 py-2 text-sm font-bold text-white cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleGroup(supplierName);}}>
                                      <div className="flex items-center space-x-1">
                                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-400 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                          </svg>
                                          <span>{supplierName}</span>
                                      </div>
                                  </td>
                              </tr>
                              {isExpanded && groupedItems[supplierName].map((item: Item) => (
                                  <ItemRow 
                                      key={item.id} 
                                      item={item} 
                                      suppliers={sortedSuppliers}
                                      isGrouped={true}
                                      latestPrice={getLatestItemPrice(item.id, item.supplierId, state.itemPrices)?.price}
                                      onUpdate={handleItemUpdate}
                                      onEdit={handleEditClick}
                                      onDelete={handleDeleteItem}
                                  />
                              ))}
                          </React.Fragment>
                        )})
                  ) : (
                      filteredItems.map((item: Item) => (
                          <ItemRow 
                              key={item.id} 
                              item={item} 
                              suppliers={sortedSuppliers}
                              isGrouped={false}
                              latestPrice={getLatestItemPrice(item.id, item.supplierId, state.itemPrices)?.price}
                              onUpdate={handleItemUpdate}
                              onEdit={handleEditClick}
                              onDelete={handleDeleteItem}
                          />
                      ))
                  )}
              </tbody>
          </table>
      </div>

      {selectedItemForModal && isEditModalOpen && (
        <EditItemModal
            item={selectedItemForModal}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSave={actions.updateItem}
            onDelete={handleDeleteItem}
        />
      )}
    </div>
  );
};

export default ItemsSettings;