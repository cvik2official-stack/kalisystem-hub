import React, { useState, useEffect, useRef } from 'react';
import { OrderItem, Unit } from '../../types';

interface NumpadModalProps {
  item: OrderItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (quantity: number, unit?: Unit) => void;
  onDelete: () => void;
}

const NumpadModal: React.FC<NumpadModalProps> = ({ item, isOpen, onClose, onSave, onDelete }) => {
  const [value, setValue] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit | undefined>(undefined);
  const [isUnitPickerOpen, setIsUnitPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const unitButtonRef = useRef<HTMLButtonElement>(null);
  const unitPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue('');
      setSelectedUnit(item.unit);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
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
    if (isUnitPickerOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUnitPickerOpen]);

  const handleInput = (char: string) => {
    if (char === '.' && value.includes('.')) return;
    if (value === '0' && char !== '.') {
      setValue(char);
    } else {
      setValue(prev => prev + char);
    }
  };

  const handleClear = () => setValue('');
  const handleBackspace = () => setValue(value.slice(0, -1));

  const handleSave = () => {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && value) {
      onSave(numericValue, selectedUnit);
    } else {
      // If the input is empty but a unit was selected, just save the unit change with the original quantity.
      onSave(item.quantity, selectedUnit);
    }
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };
  
  const handleUnitSelect = (unit: Unit) => {
    setSelectedUnit(unit);
    setIsUnitPickerOpen(false);
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start md:items-center justify-center z-50 p-4 pt-16 md:pt-4" onClick={onClose}>
      <div className="relative bg-gray-800 rounded-xl shadow-2xl p-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <button onClick={handleDelete} className="absolute top-2 left-2 text-gray-500 hover:text-white p-1" aria-label="Delete item">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
        </button>
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
          <div className="relative">
              <button
                  ref={unitButtonRef}
                  onClick={() => setIsUnitPickerOpen(prev => !prev)}
                  className="p-3 bg-gray-600 rounded-lg hover:bg-gray-500 w-full h-full flex items-center justify-center text-sm font-semibold"
              >
                  {selectedUnit || 'unit'}
              </button>
              {isUnitPickerOpen && (
                  <div 
                    ref={unitPickerRef} 
                    className="absolute bottom-full right-0 mb-2 bg-gray-700 rounded-lg shadow-lg p-1 z-10 max-h-64 w-32 overflow-y-auto hide-scrollbar"
                  >
                      <div className="grid grid-cols-1 gap-1">
                      {Object.values(Unit).map(u => (
                          <button
                              key={u}
                              onClick={() => handleUnitSelect(u as Unit)}
                              className="px-3 py-1.5 text-sm text-left rounded-md hover:bg-indigo-600 whitespace-nowrap"
                          >
                              {u}
                          </button>
                      ))}
                      </div>
                  </div>
              )}
          </div>
          
          <button onClick={() => handleInput('0')} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 col-span-2">0</button>
          <button onClick={() => handleInput('.')} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 aspect-square flex items-center justify-center">.</button>
          <button onClick={handleSave} className="p-3 bg-green-600 rounded-lg hover:bg-green-500 aspect-square flex items-center justify-center">OK</button>
        </div>
      </div>
    </div>
  );
};

export default NumpadModal;