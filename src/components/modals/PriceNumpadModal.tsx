import React, { useState, useEffect, useRef } from 'react';
import { OrderItem, Unit } from '../../types';

interface PriceNumpadModalProps {
  item: OrderItem;
  supplierId: string; // Not used directly in modal, but useful for context
  isOpen: boolean;
  onClose: () => void;
  onSave: (price: number, unit: Unit, isMaster: boolean) => void;
}

const PriceNumpadModal: React.FC<PriceNumpadModalProps> = ({ item, isOpen, onClose, onSave }) => {
  const [value, setValue] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit>(Unit.PC);
  const [isUnitPickerOpen, setIsUnitPickerOpen] = useState(false);
  const [isMaster, setIsMaster] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const unitButtonRef = useRef<HTMLButtonElement>(null);
  const unitPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue('');
      setSelectedUnit(item.unit || Unit.PC);
      setIsMaster(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, item]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (
            unitPickerRef.current &&
            !unitPickerRef.current.contains(event.target as Node) &&
            unitButtonRef.current &&
            !unitButtonRef.current.contains(event.target as Node)
        ) {
            setIsUnitPickerOpen(false);
        }
    };
    if (isUnitPickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUnitPickerOpen]);

  const handleInput = (char: string) => {
    if (char === '.' && value.includes('.')) return;
    if (value === '0' && char !== '.') setValue(char);
    else setValue(prev => prev + char);
  };

  const handleClear = () => setValue('');
  const handleBackspace = () => setValue(value.slice(0, -1));

  const handleSave = () => {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && value) {
      const priceToSave = numericValue > 1000 ? numericValue / 4000 : numericValue;
      onSave(priceToSave, selectedUnit, isMaster);
    }
  };
  
  const handleUnitSelect = (unit: Unit) => {
    setSelectedUnit(unit);
    setIsUnitPickerOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === "" || /^[0-9]*\.?[0-9]*$/.test(rawValue)) setValue(rawValue);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-white" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h3 className="text-lg font-bold text-white mb-2 text-center truncate">Set Price: {item.name}</h3>
        
        <input
          ref={inputRef}
          type="text"
          id="price-numpad-input"
          inputMode="decimal"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="w-full bg-gray-900 text-white text-3xl font-mono text-right rounded-md p-3 mb-3 outline-none ring-2 ring-transparent focus:ring-indigo-500"
          aria-label="Price input"
        />

        <div className="grid grid-cols-4 gap-2 text-xl">
          {['1', '2', '3'].map(n => <button key={n} onClick={() => handleInput(n)} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 aspect-square flex items-center justify-center">{n}</button>)}
          <button onClick={handleBackspace} className="p-3 bg-yellow-600 rounded-lg hover:bg-yellow-500 aspect-square flex items-center justify-center">⌫</button>
          {['4', '5', '6'].map(n => <button key={n} onClick={() => handleInput(n)} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 aspect-square flex items-center justify-center">{n}</button>)}
          <button onClick={handleClear} className="p-3 bg-red-600 rounded-lg hover:bg-red-500 aspect-square flex items-center justify-center">C</button>
          {['7', '8', '9'].map(n => <button key={n} onClick={() => handleInput(n)} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 aspect-square flex items-center justify-center">{n}</button>)}
          <div className="relative">
              <button ref={unitButtonRef} onClick={() => setIsUnitPickerOpen(prev => !prev)} className="p-3 bg-gray-600 rounded-lg hover:bg-gray-500 w-full h-full flex items-center justify-center text-sm font-semibold">{selectedUnit || 'unit'}</button>
              {isUnitPickerOpen && (
                  <div ref={unitPickerRef} className="absolute bottom-full right-0 mb-2 bg-gray-700 rounded-lg shadow-lg p-1 z-10 max-h-64 w-32 overflow-y-auto hide-scrollbar">
                      <div className="grid grid-cols-1 gap-1">
                      {/* FIX: Cast enum value to string for key property */}
                      {Object.values(Unit).map(u => <button key={u as string} onClick={() => handleUnitSelect(u as Unit)} className="px-3 py-1.5 text-sm text-left rounded-md hover:bg-indigo-600 whitespace-nowrap">{u}</button>)}
                      </div>
                  </div>
              )}
          </div>
          <button onClick={() => handleInput('0')} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 col-span-2">0</button>
          <button onClick={() => handleInput('.')} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 aspect-square flex items-center justify-center">.</button>
          <button onClick={handleSave} className="p-3 bg-green-600 rounded-lg hover:bg-green-500 aspect-square flex items-center justify-center">OK</button>
        </div>
        
        <div className="flex items-center justify-center mt-3">
            <input id="is-master-price-numpad" type="checkbox" checked={isMaster} onChange={(e) => setIsMaster(e.target.checked)} className="h-4 w-4 rounded bg-gray-900 border-gray-600 text-indigo-600 focus:ring-indigo-500" />
            <label htmlFor="is-master-price-numpad" className="ml-2 block text-sm text-gray-300">Set as master price</label>
        </div>
      </div>
    </div>
  );
};

export default PriceNumpadModal;