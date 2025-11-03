/*
  NOTE FOR DATABASE SETUP:
  This component manages item stock, which requires new database columns.
  Please run the following SQL commands in your Supabase SQL Editor to avoid errors:

  -- Add a boolean to flag items for stock tracking
  ALTER TABLE public.items ADD COLUMN IF NOT EXISTS track_stock BOOLEAN DEFAULT FALSE;

  -- Add a numeric column to store the stock quantity
  ALTER TABLE public.items ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC DEFAULT 0;
*/
import React, { useContext, useState, useMemo, useRef } from 'react';
import { AppContext } from '../../context/AppContext';
import { Item, Unit, SupplierName } from '../../types';
import EditItemModal from '../modals/EditItemModal';
import ContextMenu from '../ContextMenu';
import ConfirmationModal from '../modals/ConfirmationModal';

const ItemsSettings: React.FC = () => {
  const { state, actions } = useContext(AppContext);
  
  const [isNewItemModalOpen, setNewItemModalOpen] = useState(false);
  const [itemForModal, setItemForModal] = useState<Item | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: Item } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editedItemData, setEditedItemData] = useState<Partial<Item>>({});

  const longPressTimer = useRef<number | null>(null);

  const handleSaveFromModal = async (item: Item | Omit<Item, 'id'>) => {
    if ('id' in item && item.id.startsWith('new_')) {
        const { id, ...newItem } = item;
        await actions.addItem(newItem);
    } else {
        await actions.updateItem(item as Item);
    }
  };
  
  const handleDeleteItem = async () => {
    if (itemToDelete) {
      await actions.deleteItem(itemToDelete.id);
      setItemToDelete(null);
    }
  };
  
  const handleEditClick = (item: Item) => {
    setEditingItemId(item.id);
    setEditedItemData(item);
  };
  
  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditedItemData({});
  };

  const handleInlineSave = async () => {
    if (editingItemId && editedItemData) {
      const supplier = state.suppliers.find(s => s.id === editedItemData.supplierId);
      if (supplier) {
        await actions.updateItem({ ...editedItemData, supplierName: supplier.name } as Item);
      }
      setEditingItemId(null);
      setEditedItemData({});
    }
  };
  
  const handleItemDataChange = (field: keyof Item, value: any) => {
      setEditedItemData({ ...editedItemData, [field]: value });
  };

  const handleAddNewItem = () => {
    const defaultSupplier = state.suppliers[0];
    if (!defaultSupplier) {
        alert('No suppliers found in the database.');
        return;
    }
    setItemForModal({ 
        id: `new_${Date.now()}`, 
        name: '', 
        supplierId: defaultSupplier.id,
        supplierName: defaultSupplier.name,
        unit: Unit.PC 
    });
    setNewItemModalOpen(true);
  };

  const handleEditItemInModal = (item: Item) => {
    setItemForModal(item);
    setNewItemModalOpen(true);
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
  
  const handlePressStart = (e: React.MouseEvent | React.TouchEvent, item: Item) => {
    if ('button' in e && e.button === 2) return; // Allow right-click to pass to onContextMenu
    longPressTimer.current = window.setTimeout(() => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setContextMenu({ x: clientX, y: clientY, item });
    }, 500);
  };

  const handlePressEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleContextMenu = (e: React.MouseEvent, item: Item) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };
  
  const getContextMenuOptions = (item: Item) => {
    return [
      { label: 'Add to Dispatch', action: () => actions.addItemToDispatch(item) },
      { label: item.trackStock ? 'Disable Stock Tracking' : 'Enable Stock Tracking', action: () => actions.updateItem({ ...item, trackStock: !item.trackStock }) },
      { label: 'Edit...', action: () => handleEditItemInModal(item) },
      { label: 'Delete Item', action: () => setItemToDelete(item), isDestructive: true },
    ];
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
        <button 
          onClick={handleAddNewItem}
          className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700"
          aria-label="Add New Item"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col w-full">
           <div className="flex-grow overflow-y-auto hide-scrollbar">
              <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800 sticky top-0 z-10">
                  <tr>
                    <th className="pl-4 pr-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Supplier</th>
                    <th className="pl-2 pr-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {filteredItems.map(item => {
                      const isEditing = editingItemId === item.id;
                      return (
                        <tr 
                          key={item.id}
                          className="hover:bg-gray-700/50"
                          onContextMenu={(e) => handleContextMenu(e, item)}
                          onMouseDown={(e) => handlePressStart(e, item)}
                          onMouseUp={handlePressEnd}
                          onMouseLeave={handlePressEnd}
                          onTouchStart={(e) => handlePressStart(e, item)}
                          onTouchEnd={handlePressEnd}
                        >
                            <td className="pl-4 pr-2 py-1 text-white text-sm whitespace-nowrap">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editedItemData.name || ''}
                                  onChange={(e) => handleItemDataChange('name', e.target.value)}
                                  className="bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-1 w-full"
                                />
                              ) : (
                                <>
                                {item.name}
                                {item.trackStock && (
                                    <span className="ml-2 text-yellow-400 font-mono text-xs">
                                        (stock: {item.stockQuantity ?? 0})
                                    </span>
                                )}
                                </>
                              )}
                            </td>
                            <td className="px-2 py-1 text-gray-300 text-sm whitespace-nowrap">
                              {isEditing ? (
                                <select
                                    value={editedItemData.supplierId || ''}
                                    onChange={(e) => handleItemDataChange('supplierId', e.target.value)}
                                    className="bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-1 w-full"
                                >
                                    {state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                              ) : (
                                item.supplierName
                              )}
                            </td>
                             <td className="pl-2 pr-4 py-1 text-right">
                               <div className="flex items-center justify-end space-x-2">
                                  {isEditing ? (
                                    <>
                                        <button onClick={handleInlineSave} className="p-1 rounded-full text-green-400 hover:bg-green-600 hover:text-white" aria-label="Save item">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                        </button>
                                        <button onClick={handleCancelEdit} className="p-1 rounded-full text-red-400 hover:bg-red-600 hover:text-white" aria-label="Cancel edit">
                                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => handleEditClick(item)}
                                      className="p-1 rounded-full text-indigo-400 hover:bg-indigo-600 hover:text-white"
                                      aria-label="Edit item"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                            </td>
                        </tr>
                    )}
                  )}
              </tbody>
              </table>
          </div>
      </div>
      
      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x}
          y={contextMenu.y}
          options={getContextMenuOptions(contextMenu.item)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {itemToDelete && (
        <ConfirmationModal
            isOpen={!!itemToDelete}
            onClose={() => setItemToDelete(null)}
            onConfirm={handleDeleteItem}
            title="Delete Item"
            message={`Are you sure you want to delete "${itemToDelete.name}"? This action cannot be undone.`}
            isDestructive
        />
      )}

      {(itemForModal || isNewItemModalOpen) && (
        <EditItemModal 
            item={itemForModal!} 
            isOpen={isNewItemModalOpen} 
            onClose={() => {
                setNewItemModalOpen(false);
                setItemForModal(null);
            }} 
            onSave={handleSaveFromModal}
            onDelete={async (itemId: string) => {
                const item = state.items.find(i => i.id === itemId);
                if (item) {
                    setItemToDelete(item);
                }
                setNewItemModalOpen(false);
                setItemForModal(null);
            }}
        />
      )}
    </div>
  );
};

export default ItemsSettings;