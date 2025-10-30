
import React, { useState, useEffect, useRef } from 'react';
import { OrderItem, Unit } from '../../types';

interface NumpadModalProps {
  item: OrderItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (quantity: number, unit?: Unit) => void;
}

const NumpadModal: React.FC<NumpadModalProps> = ({ item, isOpen, onClose, onSave }) => {
  const [value, setValue] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // When the modal opens, clear the input value and set the unit from the item.
      setValue('');
      setSelectedUnit(item.unit);

      // Focus the input field for immediate typing.
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, item]); // Rerun effect if the modal is reopened or the item changes.

  const handleInput = (char: string) => {
    if (char === '.' && value.includes('.')) return;
    if (value === '0' && char !== '.') {
      setValue(char);
    } else {
      setValue(prev => prev + char);
    }
  };

  const handleClear = () => setValue('0');
  const handleBackspace = () => setValue(value.slice(0, -1) || '0');

  const handleSave = () => {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue)) {
      onSave(numericValue, selectedUnit);
    }
    // If input is invalid (e.g., "" or "."), do nothing, let user correct it.
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === "" || /^[0-9]*\.?[0-9]*$/.test(rawValue)) {
      setValue(rawValue);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-4 w-full max-w-xs mx-4" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-white" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h3 className="text-lg font-bold text-white mb-2 text-center truncate">{item.name}</h3>
        
        <input
          ref={inputRef}
          type="text"
          id="numpad-quantity-input"
          name="numpad-quantity-input"
          inputMode="decimal"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="w-full bg-gray-900 text-white text-3xl font-mono text-right rounded-md p-3 mb-3 outline-none ring-2 ring-transparent focus:ring-indigo-500"
          aria-label="Quantity input"
        />

        <div className="grid grid-cols-4 gap-2 text-xl">
          {['1', '2', '3'].map(n => <button key={n} onClick={() => handleInput(n)} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 aspect-square flex items-center justify-center"> {n} </button>)}
          <button onClick={handleBackspace} className="p-3 bg-yellow-600 rounded-lg hover:bg-yellow-500 aspect-square flex items-center justify-center">⌫</button>

          {['4', '5', '6'].map(n => <button key={n} onClick={() => handleInput(n)} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 aspect-square flex items-center justify-center"> {n} </button>)}
          <button onClick={handleClear} className="p-3 bg-red-600 rounded-lg hover:bg-red-500 aspect-square flex items-center justify-center">C</button>
          
          {['7', '8', '9'].map(n => <button key={n} onClick={() => handleInput(n)} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 aspect-square flex items-center justify-center"> {n} </button>)}
          <button onClick={handleSave} className="p-3 bg-green-600 rounded-lg hover:bg-green-500 row-span-2 flex items-center justify-center">OK</button>
          
          <button onClick={() => handleInput('0')} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 col-span-2">0</button>
          <button onClick={() => handleInput('.')} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 aspect-square flex items-center justify-center">.</button>
        </div>
      </div>
    </div>
  );
};

export default NumpadModal;