import React, { useState, useEffect, useContext } from 'react';
import { OrderItem, Unit, ItemPrice } from '../../types';
import { AppContext } from '../../context/AppContext';
import { useToasts } from '../../context/ToastContext';
import { upsertItemPrice } from '../../services/supabaseService';

interface SetUnitPriceModalProps {
  item: OrderItem;
  supplierId: string;
  isOpen: boolean;
  onClose: () => void;
}

const SetUnitPriceModal: React.FC<SetUnitPriceModalProps> = ({ item, supplierId, isOpen, onClose }) => {
  const { state } = useContext(AppContext);
  const { addToast } = useToasts();
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<Unit>(Unit.PC);
  const [isMaster, setIsMaster] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUnit(item.unit || Unit.PC);
      setPrice(''); // Reset price field on open
      setIsMaster(true);
    }
  }, [isOpen, item]);

  const handleSave = async () => {
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      addToast('Please enter a valid price.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const itemPrice: ItemPrice = {
        itemId: item.itemId,
        supplierId,
        price: numericPrice,
        unit,
        isMaster,
      };
      await upsertItemPrice({ 
          itemPrice, 
          url: state.settings.supabaseUrl, 
          key: state.settings.supabaseKey 
      });
      addToast(`Price for ${item.name} set to ${numericPrice}/${unit}.`, 'success');
      onClose();
    } catch (error: any) {
      addToast(`Failed to set price: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 className="text-xl font-bold text-white mb-2">Set Unit Price</h2>
        <p className="text-gray-400 mb-4 text-sm truncate">For: {item.name}</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="item-price" className="block text-sm font-medium text-gray-300">Price</label>
            <input
              type="number"
              id="item-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
              placeholder="0.00"
              step="0.01"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="price-unit" className="block text-sm font-medium text-gray-300">Per Unit</label>
            <select
              id="price-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              className="mt-1 w-full bg-gray-900 text-gray-200 rounded-md p-2 outline-none ring-1 ring-gray-700 focus:ring-2 focus:ring-indigo-500"
            >
              {Object.values(Unit).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center">
            <input
              id="is-master-price"
              type="checkbox"
              checked={isMaster}
              onChange={(e) => setIsMaster(e.target.checked)}
              className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="is-master-price" className="ml-2 block text-sm text-gray-300">Set as master price</label>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={handleSave} disabled={isSaving} className="px-5 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-indigo-800 disabled:cursor-wait">
            {isSaving ? 'Saving...' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetUnitPriceModal;