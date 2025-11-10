import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { Item, Unit, SupplierName } from '../../types';
import { useNotifier } from '../../context/NotificationContext';
import EditItemModal from '../modals/EditItemModal';
import CreateVariantModal from '../modals/CreateVariantModal';
import ResizableTable from '../common/ResizableTable';

const ItemsSettings: React.FC = () => {
  const { state, actions } = useContext(AppContext);
  const { notify } = useNotifier();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState<Item | null>(null);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [parentItemForVariant, setParentItemForVariant] = useState<Item | null>(null);

  const handleItemUpdate = async (item: Item, field: keyof Item, value: any) => {
    if (item[field] === value) return; // No change
    await actions.updateItem({ ...item, [field]: value });
  };

  const handlePriceUpdate = async (item: Item, priceStr: string) => {
    const newPrice = priceStr.trim() === '' ? 0 : parseFloat(priceStr);
    const masterPrice = state.itemPrices.find(p => p.itemId === item.id && p.isMaster);
    if (masterPrice?.price === newPrice) return;

    if (!isNaN(newPrice) && newPrice >= 0) {
        await actions.upsertItemPrice({
            itemId: item.id,
            supplierId: item.supplierId,
            price: newPrice,
            unit: item.unit,
            isMaster: true,
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
    if (window.confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      await actions.deleteItem(itemId);
    }
  };
  
  const handleEditClick = (item: Item) => {
    setSelectedItemForModal(item);
    setIsEditModalOpen(true);
  };

  const handleTriggerCreateVariant = () => {
    if (selectedItemForModal) {
      setIsEditModalOpen(false);
      setParentItemForVariant(selectedItemForModal);
      setIsVariantModalOpen(true);
    }
  };

  const handleCreateVariant = async (variantData: { name: string; supplierId: string; unit: Unit; price?: number; trackStock: boolean; stockQuantity?: number; }) => {
    if (!parentItemForVariant) return;

    const supplier = state.suppliers.find(s => s.id === variantData.supplierId);
    if (!supplier) {
      notify('Selected supplier not found.', 'error');
      return;
    }

    const baseNameMatch = parentItemForVariant.name.match(/^(.*?)\s*\(/);
    const baseName = baseNameMatch ? baseNameMatch[1].trim() : parentItemForVariant.name;
    
    let newItemName = variantData.name ? `${baseName} (${variantData.name})` : baseName;
    if (variantData.trackStock && !newItemName.startsWith('> ')) {
        newItemName = `> ${newItemName}`;
    }

    const parentIdForNewVariant = parentItemForVariant.parentId || parentItemForVariant.id;
    
    setIsCreating(true);
    try {
        const newVariantMasterItem = await actions.addItem({
          name: newItemName,
          unit: variantData.unit,
          supplierId: variantData.supplierId,
          supplierName: supplier.name,
          parentId: parentIdForNewVariant,
          isVariant: true,
          trackStock: variantData.trackStock,
          stockQuantity: variantData.stockQuantity,
        });

        if (variantData.price) {
            await actions.upsertItemPrice({
                itemId: newVariantMasterItem.id,
                supplierId: variantData.supplierId,
                price: variantData.price,
                unit: variantData.unit,
                isMaster: true,
            });
        }

        notify(`Variant "${newVariantMasterItem.name}" created.`, 'success');
    } finally {
        setIsVariantModalOpen(false);
        setParentItemForVariant(null);
        setIsCreating(false);
    }
  };

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

  const columns = useMemo(() => [
    { 
      id: 'name', header: 'Name', initialWidth: 300,
      cell: (item: Item) => (
        <input
            type="text"
            defaultValue={item.name}
            onBlur={(e) => handleItemUpdate(item, 'name', e.target.value)}
            className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500"
        />
      )
    },
    {
      id: 'supplier', header: 'Supplier', initialWidth: 150,
      cell: (item: Item) => item.supplierName
    },
    {
      id: 'unit', header: 'Unit', initialWidth: 100,
      cell: (item: Item) => (
        <select
            defaultValue={item.unit}
            onChange={(e) => handleItemUpdate(item, 'unit', e.target.value as Unit)}
            className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500"
        >
            {Object.values(Unit).map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      )
    },
    {
      id: 'unitPrice', header: 'Unit Price', initialWidth: 100,
      cell: (item: Item) => {
        const masterPrice = state.itemPrices.find(p => p.itemId === item.id && p.isMaster)?.price;
        return (
            <input
                type="text"
                inputMode="decimal"
                defaultValue={masterPrice != null ? masterPrice.toFixed(2) : ''}
                onBlur={(e) => handlePriceUpdate(item, e.target.value)}
                placeholder="-"
                className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 text-right"
            />
        );
      }
    },
    {
      id: 'stockQty', header: 'Stock Qty', initialWidth: 100,
      cell: (item: Item) => item.trackStock ? (
        <input
            type="text"
            inputMode="numeric"
            defaultValue={item.stockQuantity || 0}
            onBlur={(e) => handleItemUpdate(item, 'stockQuantity', parseInt(e.target.value, 10) || 0)}
            className="bg-transparent p-1 w-full rounded focus:bg-gray-900 focus:ring-1 focus:ring-indigo-500 text-right"
        />
      ) : '-'
    },
    {
      id: 'actions', header: 'Actions', initialWidth: 80,
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
  ], [state.itemPrices, state.items]);

  return (
    <div className="flex flex-col flex-grow">
      <ResizableTable
        columns={columns}
        data={filteredItems}
        tableKey="items-settings"
        toolbar={
          <div className="flex justify-between items-center mb-4 w-full">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Search items..."
            />
          </div>
        }
        rightAlignedActions={
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
        }
      />

      {selectedItemForModal && isEditModalOpen && (
        <EditItemModal
            item={selectedItemForModal}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSave={actions.updateItem}
            onDelete={handleDeleteItem}
            onTriggerCreateVariant={handleTriggerCreateVariant}
        />
      )}
      {parentItemForVariant && isVariantModalOpen && (
        <CreateVariantModal
            isOpen={isVariantModalOpen}
            onClose={() => { setIsVariantModalOpen(false); setParentItemForVariant(null); }}
            parentItem={parentItemForVariant}
            isStockVariantFlow={false}
            onCreate={handleCreateVariant}
        />
      )}
    </div>
  );
};

export default ItemsSettings;