import React, { useState, useEffect, useContext } from 'react';
import { Item, OrderItem, Unit, Supplier, SupplierName } from '../../types';
import { AppContext } from '../../context/AppContext';

interface CreateVariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentItem: Item; // Now accepts a full Item, not an OrderItem
  isStockVariantFlow: boolean;
  onCreate: (variantData: {
      name: string;
      supplierId: string;
      unit: Unit;
      price?: number;
      trackStock: boolean;
      stockQuantity?: number;
  }) => Promise<void>;
}

const CreateVariantModal: React.FC<CreateVariantModalProps> = ({ isOpen, onClose, parentItem, isStockVariantFlow, onCreate }) => {
  const { state } = useContext(AppContext);
  const [variantName, setVariantName] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<Unit>(Unit.PC);
  const [price, setPrice] = useState('');
  const [trackStock, setTrackStock] = useState(false);
  const [stockQuantity, setStockQuantity] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const stockSupplier = state.suppliers.find(s => s.name === SupplierName.STOCK);

  useEffect(() => {
    if (isOpen) {
      setVariantName('');
      setSelectedUnit(parentItem.unit);
      setPrice('');
      setStockQuantity('');
      if (isStockVariantFlow && stockSupplier) {
        setTrackStock(true);
        setSelectedSupplierId(stockSupplier.id);
      } else {
        setTrackStock(parentItem.trackStock || false);
        setSelectedSupplierId(parentItem.supplierId);
      }
      setIsCreating(false);
    }
  }, [isOpen, parentItem, isStockVariantFlow, stockSupplier]);

  const handleCreate = async () => {
    if (!variantName.trim()) return;
    setIsCreating(true);
    try {
      await onCreate({
          name: variantName.trim(),
          supplierId: selectedSupplierId,
          unit: selectedUnit,
          price: price ? parseFloat(price) : undefined,
          trackStock: trackStock,
          stockQuantity: stockQuantity ? parseInt(stockQuantity, 10) : undefined,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setPrice(value);
    }
  };
  
  const handleStockQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^[0-9]*$/.test(value)) {
      setStockQuantity(value);
    }
  };

  if (!isOpen) return null;
  
  const isLocked = trackStock || isStockVariantFlow;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-[60] p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md border-t-4 border-indigo-500" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} disabled={isCreating} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-2">{isStockVariantFlow ? 'Create Stock Variant' : 'Create a Variant'}</h2>
        <p className="text-sm text-gray-400 mb-4">for <span className="font-semibold text-gray-300">{parentItem.name}</span></p>

        <div className="space-y-4">
            <div>
              <label htmlFor="variant-name" className="block text-sm font-medium text-gray-300">Variant Name</label>
              <input
                type="text"
                id="variant-name"
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                autoFocus
                className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                disabled={isCreating}
              />
            </div>
            
             <div>
                <label htmlFor="variant-supplier" className="block text-sm font-medium text-gray-300">Supplier</label>
                <select
                    id="variant-supplier"
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-700 disabled:text-gray-400"
                    disabled={isCreating || isLocked}
                >
                    {state.suppliers.sort((a,b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label htmlFor="variant-unit" className="block text-sm font-medium text-gray-300">Unit</label>
                  <select
                      id="variant-unit"
                      value={selectedUnit}
                      onChange={(e) => setSelectedUnit(e.target.value as Unit)}
                      className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-700 disabled:text-gray-400"
                      disabled={isCreating || isLocked}
                  >
                      {/* FIX: Cast enum values to an array of Unit to ensure proper type inference. */}
                      {(Object.values(Unit) as Unit[]).map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                 <div>
                  <label htmlFor="variant-price" className="block text-sm font-medium text-gray-300">Master Price (Optional)</label>
                  <input
                    type="text"
                    id="variant-price"
                    inputMode="decimal"
                    value={price}
                    onChange={handlePriceChange}
                    className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                    disabled={isCreating}
                  />
                </div>
            </div>

             <div>
                <div className="flex items-center">
                    <input
                        id="track-stock"
                        type="checkbox"
                        checked={trackStock}
                        onChange={(e) => setTrackStock(e.target.checked)}
                        className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500"
                        disabled={isCreating || isStockVariantFlow}
                    />
                    <label htmlFor="track-stock" className="ml-2 block text-sm font-medium text-gray-300">Track Stock</label>
                </div>
            </div>
            {trackStock && (
                <div>
                    <label htmlFor="stock-quantity" className="block text-sm font-medium text-gray-300">Initial Stock Quantity</label>
                    <input
                        type="text"
                        id="stock-quantity"
                        inputMode="numeric"
                        value={stockQuantity}
                        onChange={handleStockQuantityChange}
                        className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
                        disabled={isCreating}
                    />
                </div>
            )}
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={handleCreate} disabled={isCreating || !variantName.trim()} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-800 disabled:cursor-wait">
            {isCreating ? 'Creating...' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateVariantModal;