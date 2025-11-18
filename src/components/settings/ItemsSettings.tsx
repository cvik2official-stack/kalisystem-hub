
import React, { useContext, useState, useMemo, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import { Item, Unit, SupplierName } from '../../types';
import { useNotifier } from '../../context/NotificationContext';
import EditItemModal from '../modals/EditItemModal';
import { getLatestItemPrice } from '../../utils/messageFormatter';

interface ItemsSettingsProps {
    setMenuOptions: (options: any[]) => void;
}

const ItemsSettings: React.FC<ItemsSettingsProps> = ({ setMenuOptions }) => {
  const { state, actions } = useContext(AppContext);
  const { notify } = useNotifier();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState<Item | null>(null);
  const [isGrouped, setIsGrouped] = useState(false);

  const [editingField, setEditingField] = useState<string | null>(null); // e.g., 'item_id-name'
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  const handleItemUpdate = async (item: Item, field: keyof Item, value: any) => {
    if (String(item[field] ?? '') === String(value)) return; // No change

    const finalName = field === 'name' ? String(value).trim() : item.name;
    const finalSupplierId = field === 'supplierId' ? value : item.supplierId;

    if (field === 'name' && !finalName) {
      notify('Item name cannot be empty.', 'error');
      return;
    }

    const duplicateExists = state.items.some(
      i =>
        i.id !== item.id &&
        i.name.toLowerCase() === finalName.toLowerCase() &&
        i.supplierId === finalSupplierId
    );

    if (duplicateExists) {
      const supplierName =
        state.suppliers.find(s => s.id === finalSupplierId)?.name || 'this supplier';
      notify(`An item named "${finalName}" from ${supplierName} already exists.`, 'error');
      return;
    }

    let itemToUpdate = { ...item, [field]: value };

    if (field === 'name') {
      itemToUpdate.name = finalName;
    }

    if (field === 'supplierId') {
      const newSupplier = state.suppliers.find(s => s.id === value);
      if (newSupplier) {
        itemToUpdate.supplierName = newSupplier.name;
      }
    }

    await actions.updateItem(itemToUpdate);
  };

  const handleStockQuantityUpdate = async (item: Item, qtyStr: string) => {
    const newQty = qtyStr.trim() === '' ? undefined : parseFloat(qtyStr);
    
    if (item.stockQuantity === newQty) return;
    
    if (newQty === undefined || !isNaN(newQty)) {
        await actions.updateItem({ ...item, stockQuantity: newQty });
    } else {
        notify('Invalid stock quantity.', 'error');
    }
  };

  const handlePriceUpdate = async (item: Item, priceStr: string) => {
    let newPrice = priceStr.trim() === '' ? 0 : parseFloat(priceStr);
    const latestPrice = getLatestItemPrice(item.id, item.supplierId, state.itemPrices)?.price;

    if (newPrice > 1000) {
        newPrice = newPrice / 4000;
    }

    if (latestPrice === newPrice) return;

    if (!isNaN(newPrice) && newPrice >= 0) {
        await actions.upsertItemPrice({
            itemId: item.id,
            supplierId: item.supplierId,
            price: newPrice,
            unit: item.unit,
        });
    } else {
        notify('Invalid price.', 'error');
    }
  };

  const handleAddNewItem = async () => {
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
        handleEditClick(newItem); // Open edit modal for the new item
    } finally {
        setIsCreating(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    await actions.deleteItem(itemId);
  };
  
  const handleEditClick = (item: Item) => {
    setSelectedItemForModal(item);
    setIsEditModalOpen(true);
  };

    const toggleGroup = (supplierName: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(supplierName)) {
                newSet.delete(supplierName);
            } else {
                newSet.add(supplierName);
            }
            return newSet;
        });
    };
    
  const handleExportItemsCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["Name", "Supplier", "Unit", "Stock Qty", "Price"];
    csvContent += headers.join(",") + "\r\n";

    filteredItems.forEach(item => {
        const price = getLatestItemPrice(item.id, item.supplierId, state.itemPrices)?.price ?? '';
        const row = [
            `"${item.name.replace(/"/g, '""')}"`,
            item.supplierName,
            item.unit,
            item.stockQuantity ?? '',
            price
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
  };

  useEffect(() => {
    const options = [
        { label: 'Search', action: () => setIsSearchVisible(prev => !prev) },
        { label: 'Add New', action: handleAddNewItem },
        { label: isGrouped ? 'Ungroup' : 'Group by Supplier', action: () => setIsGrouped(!isGrouped) },
        { label: 'Export to CSV', action: handleExportItemsCsv }
    ];
    setMenuOptions(options);

    return () => setMenuOptions([]);
  }, [handleAddNewItem, setMenuOptions, isGrouped, filteredItems]); // Add filteredItems to deps


  
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

  const columns = useMemo(() => {
      const allColumns = [
        {
            id: 'handle', header: '',
            cell: () => (
              <div className="cursor-grab text-gray-500 hover:text-white flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>
              </div>
            )
        },
        { 
          id: 'name', header: 'Name',
          cell: (item: Item) => {
                const fieldId = `${item.id}-name`;
                return editingField === fieldId ? (
                    <input
                        type="text"
                        defaultValue={item.name}
                        autoFocus
                        onBlur={(e) => { handleItemUpdate(item, 'name', e.target.value); setEditingField(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingField(null); }}
                        className="bg-gray-900 p-1 w-full rounded outline-none"
                    />
                ) : (
                    <div className="truncate p-1 cursor-pointer w-full rounded" onClick={(e) => { e.stopPropagation(); setEditingField(fieldId); }}>
                        {item.name}
                    </div>
                )
            }
        },
        {
          id: 'supplier', header: 'Supplier',
          cell: (item: Item) => {
                const fieldId = `${item.id}-supplierId`;
                return editingField === fieldId ? (
                     <select
                        defaultValue={item.supplierId}
                        autoFocus
                        onBlur={() => setEditingField(null)}
                        onChange={(e) => { handleItemUpdate(item, 'supplierId', e.target.value); setEditingField(null); }}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditingField(null); }}
                        className="bg-gray-900 p-1 w-full rounded outline-none"
                    >
                        {state.suppliers.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                ) : (
                    <div className="truncate p-1 cursor-pointer w-full rounded" onClick={(e) => { e.stopPropagation(); setEditingField(fieldId); }}>
                        {item.supplierName}
                    </div>
                )
            }
        },
        {
          id: 'unit', header: 'Unit',
          cell: (item: Item) => {
                const fieldId = `${item.id}-unit`;
                return editingField === fieldId ? (
                    <select
                        defaultValue={item.unit}
                        autoFocus
                        onBlur={() => setEditingField(null)}
                        onChange={(e) => { handleItemUpdate(item, 'unit', e.target.value as Unit); setEditingField(null); }}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditingField(null); }}
                        className="bg-gray-900 p-1 w-full rounded outline-none"
                    >
                        {(Object.values(Unit) as Unit[]).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                ) : (
                    <div className="p-1 cursor-pointer w-full rounded" onClick={(e) => { e.stopPropagation(); setEditingField(fieldId); }}>
                        {item.unit}
                    </div>
                )
            }
        },
        {
          id: 'stockQuantity', header: 'STOCK QTY',
          cell: (item: Item) => {
            const fieldId = `${item.id}-stockQuantity`;
            return editingField === fieldId ? (
                <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={item.stockQuantity != null ? item.stockQuantity : ''}
                    autoFocus
                    onBlur={(e) => { handleStockQuantityUpdate(item, e.target.value); setEditingField(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingField(null); }}
                    placeholder="-"
                    className="bg-gray-900 p-1 w-full rounded outline-none text-right"
                />
            ) : (
                <div className="p-1 cursor-pointer w-full rounded text-right" onClick={(e) => { e.stopPropagation(); setEditingField(fieldId); }}>
                    {item.stockQuantity != null ? item.stockQuantity : '-'}
                </div>
            )
          }
        },
        {
          id: 'unitPrice', header: 'PRICE',
          cell: (item: Item) => {
            const fieldId = `${item.id}-unitPrice`;
            const latestPrice = getLatestItemPrice(item.id, item.supplierId, state.itemPrices)?.price;
            return editingField === fieldId ? (
                <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={latestPrice != null ? latestPrice.toFixed(2) : ''}
                    autoFocus
                    onBlur={(e) => { handlePriceUpdate(item, e.target.value); setEditingField(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingField(null); }}
                    placeholder="-"
                    className="bg-gray-900 p-1 w-full rounded outline-none text-right"
                />
            ) : (
                 <div className="p-1 cursor-pointer w-full rounded text-right" onClick={(e) => { e.stopPropagation(); setEditingField(fieldId); }}>
                    {latestPrice != null ? latestPrice.toFixed(2) : '-'}
                </div>
            );
          }
        },
        {
          id: 'actions', header: 'Actions',
          cell: (item: Item) => (
            <div className="flex items-center justify-end space-x-2">
                <button onClick={() => handleEditClick(item)} className="p-1 rounded-full text-indigo-400 hover:bg-indigo-600 hover:text-white" aria-label="Edit Item">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                      <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                  </svg>
                </button>
                <button onClick={() => handleDeleteItem(item.id)} className="p-1 rounded-full text-red-500 hover:bg-red-600 hover:text-white" aria-label="Delete Item"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
          )
        }
      ];

      if (isGrouped) {
          return allColumns.filter(c => c.id !== 'supplier');
      }
      return allColumns;
  }, [state.itemPrices, state.items, state.suppliers, isGrouped, editingField]);

  const ItemRow: React.FC<{ item: Item, columnsToRender: typeof columns}> = ({ item, columnsToRender }) => (
        <tr className="hover:bg-gray-700/50">
            {columnsToRender.map(col => (
                <td key={col.id} className={`px-1 whitespace-nowrap text-sm text-gray-300 ${col.id === 'handle' ? 'py-2' : 'py-1'}`}>
                    {col.cell(item)}
                </td>
            ))}
        </tr>
  );

  return (
    <div className="flex flex-col flex-grow w-full lg:w-3/4">
        {isSearchVisible && (
            <div className="mb-4">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                    onBlur={() => { if(!searchTerm) setIsSearchVisible(false)} }
                    className="w-64 bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2 outline-none"
                    placeholder="Search items..."
                />
            </div>
        )}
      <div className="overflow-x-auto hide-scrollbar">
          <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                  <tr>
                      {columns.map(col => (
                           <th 
                            key={col.id}
                            scope="col" 
                            className={`px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider ${
                                col.id === 'handle' ? 'w-[40px]' :
                                col.id === 'name' ? 'w-[300px]' : 
                                col.id === 'supplier' ? 'w-[150px] cursor-pointer hover:bg-gray-700' : 
                                col.id === 'actions' ? 'w-[80px]' : 'w-[100px]'
                            }`}
                            onClick={col.id === 'supplier' ? () => setIsGrouped(!isGrouped) : undefined}
                           >
                            {col.header}
                           </th>
                      ))}
                  </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700" onClick={() => setEditingField(null)}>
                  {isGrouped && groupedItems ? (
                      Object.keys(groupedItems).map(supplierName => {
                        const isExpanded = expandedGroups.has(supplierName);
                        return (
                          <React.Fragment key={supplierName}>
                              <tr className="bg-gray-700/50">
                                  <td colSpan={columns.length} className="px-3 py-2 text-sm font-bold text-white cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleGroup(supplierName);}}>
                                      <div className="flex items-center space-x-1">
                                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-400 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                          </svg>
                                          <span>{supplierName}</span>
                                      </div>
                                  </td>
                              </tr>
                              {isExpanded && groupedItems[supplierName].map((item: Item) => (
                                  <ItemRow key={item.id} item={item} columnsToRender={columns} />
                              ))}
                          </React.Fragment>
                        )})
                  ) : (
                      filteredItems.map((item: Item) => (
                          <ItemRow key={item.id} item={item} columnsToRender={columns} />
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