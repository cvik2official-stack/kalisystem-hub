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
  const [tableKey, setTableKey] = useState(0);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState<Item | null>(null);
  const [isGrouped, setIsGrouped] = useState(false);

  // State for new features
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverSupplier, setDragOverSupplier] = useState<string | null>(null);


  const handleItemUpdate = async (item: Item, field: keyof Item, value: any) => {
    if (item[field] === value) return; // No change

    const finalName = field === 'name' ? String(value).trim() : item.name;
    const finalSupplierId = field === 'supplierId' ? value : item.supplierId;

    if (field === 'name' && !finalName) {
      notify('Item name cannot be empty.', 'error');
      setTableKey(k => k + 1);
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
      setTableKey(k => k + 1);
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
    const newPrice = priceStr.trim() === '' ? 0 : parseFloat(priceStr);
    const latestPrice = getLatestItemPrice(item.id, item.supplierId, state.itemPrices)?.price;

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

    const handleDragStart = (e: React.DragEvent, itemId: string) => {
        e.dataTransfer.effectAllowed = 'move';
        setDraggedItemId(itemId);
    };

    const handleDragEnd = () => {
        setDraggedItemId(null);
        setDragOverSupplier(null);
    };
    
    const handleDragOver = (e: React.DragEvent, supplierName: string) => {
        if (draggedItemId) {
            const item = state.items.find(i => i.id === draggedItemId);
            if (item && item.supplierName !== supplierName) {
                e.preventDefault();
                setDragOverSupplier(supplierName);
            }
        }
    };

    const handleDrop = async (e: React.DragEvent, targetSupplierName: string) => {
        e.preventDefault();
        if (!draggedItemId) return;

        const item = state.items.find(i => i.id === draggedItemId);
        const targetSupplier = state.suppliers.find(s => s.name === targetSupplierName);

        if (item && targetSupplier && item.supplierId !== targetSupplier.id) {
            await handleItemUpdate(item, 'supplierId', targetSupplier.id);
        }

        handleDragEnd();
    };

  useEffect(() => {
    const options = [
        { label: 'Search', action: () => setIsSearchVisible(prev => !prev) },
        { label: 'Add New', action: handleAddNewItem },
        { label: isGrouped ? 'Ungroup' : 'Group by Supplier', action: () => setIsGrouped(!isGrouped) }
    ];
    setMenuOptions(options);

    return () => setMenuOptions([]);
  }, [handleAddNewItem, setMenuOptions, isGrouped]);


  const filteredItems = useMemo(() => {
    const sortedItems = [...state.items].sort((a, b) => {
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
          id: 'name', header: 'Name',
          cell: (item: Item) => (
            <div className="truncate max-w-xs">
                <input
                    type="text"
                    defaultValue={item.name}
                    onBlur={(e) => handleItemUpdate(item, 'name', e.target.value)}
                    className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500"
                />
            </div>
          )
        },
        {
          id: 'supplier', header: 'Supplier',
          cell: (item: Item) => (
            <select
                defaultValue={item.supplierId}
                onChange={(e) => handleItemUpdate(item, 'supplierId', e.target.value)}
                className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500"
            >
                {state.suppliers.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
          )
        },
        {
          id: 'unit', header: 'Unit',
          cell: (item: Item) => (
            <select
                defaultValue={item.unit}
                onChange={(e) => handleItemUpdate(item, 'unit', e.target.value as Unit)}
                className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500"
            >
                {(Object.values(Unit) as Unit[]).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          )
        },
        {
          id: 'stockQuantity', header: 'STOCK QTY',
          cell: (item: Item) => {
            return (
                <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={item.stockQuantity != null ? item.stockQuantity : ''}
                    onBlur={(e) => handleStockQuantityUpdate(item, e.target.value)}
                    placeholder="-"
                    className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 text-right"
                />
            );
          }
        },
        {
          id: 'unitPrice', header: 'PRICE',
          cell: (item: Item) => {
            const latestPrice = getLatestItemPrice(item.id, item.supplierId, state.itemPrices)?.price;
            return (
                <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={latestPrice != null ? latestPrice.toFixed(2) : ''}
                    onBlur={(e) => handlePriceUpdate(item, e.target.value)}
                    placeholder="-"
                    className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 text-right"
                />
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
  }, [state.itemPrices, state.items, state.suppliers, isGrouped]);

  const ItemRow: React.FC<{ item: Item, columnsToRender: typeof columns}> = ({ item, columnsToRender }) => (
        <tr 
            draggable="true"
            onDragStart={(e) => handleDragStart(e, item.id)}
            onDragEnd={handleDragEnd}
            className="hover:bg-gray-700/50 cursor-grab active:cursor-grabbing"
        >
            {columnsToRender.map(col => (
                <td key={col.id} className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">
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
                    className="w-64 bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Search items..."
                />
            </div>
        )}
      <div className="overflow-x-auto hide-scrollbar">
          <table key={tableKey} className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                  <tr>
                      {columns.map(col => (
                           <th 
                            key={col.id}
                            scope="col" 
                            className={`px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider ${
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
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {isGrouped && groupedItems ? (
                      Object.keys(groupedItems).map(supplierName => {
                        const isExpanded = expandedGroups.has(supplierName);
                        return (
                          <React.Fragment key={supplierName}>
                              <tr 
                                className={`bg-gray-700/50 transition-colors ${dragOverSupplier === supplierName ? 'bg-indigo-900/50' : ''}`}
                                onDragOver={(e) => handleDragOver(e, supplierName)}
                                onDragLeave={() => setDragOverSupplier(null)}
                                onDrop={(e) => handleDrop(e, supplierName)}
                              >
                                  <td colSpan={columns.length} className="px-3 py-2 text-sm font-bold text-white cursor-pointer" onClick={() => toggleGroup(supplierName)}>
                                      <div className="flex items-center space-x-1">
                                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transform transition-transform text-gray-400 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                          </svg>
                                          <span>{supplierName}</span>
                                      </div>
                                  </td>
                              </tr>
                              {/* FIX: Explicitly type the 'item' parameter to resolve a type inference issue. */}
                              {isExpanded && groupedItems[supplierName].map((item: Item) => (
                                  <ItemRow key={item.id} item={item} columnsToRender={columns} />
                              ))}
                          </React.Fragment>
                        )})
                  ) : (
                      // FIX: Explicitly type the 'item' parameter to resolve a type inference issue.
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