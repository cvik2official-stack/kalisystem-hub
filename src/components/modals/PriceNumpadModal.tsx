import React, { useState, useEffect, useRef } from 'react';
import { OrderItem, Unit } from '../../types';
import { normalizeInputPrice } from '../../utils/currencyUtils';

interface PriceNumpadModalProps {
  item: OrderItem;
  supplierId: string; 
  isOpen: boolean;
  onClose: () => void;
  onSave: (price: number, unit: Unit) => void;
  onToggle?: () => void;
}

const PriceNumpadModal: React.FC<PriceNumpadModalProps> = ({ item, isOpen, onClose, onSave, onToggle }) => {
  const [value, setValue] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit>(Unit.PC);
  const [isUnitPickerOpen, setIsUnitPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const unitButtonRef = useRef<HTMLButtonElement>(null);
  const unitPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue('');
      setSelectedUnit(item.unit || Unit.PC);
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
    if (char === '.') {
      if (value === '' && onToggle) {
        onToggle();
        return;
      }
      if (value.includes('.')) return;
    }
    if (value === '0' && char !== '.') setValue(char);
    else setValue(prev => prev + char);
  };

  const handleClear = () => setValue('');
  const handleBackspace = () => setValue(value.slice(0, -1));

  const handleSave = () => {
    let numericValue = parseFloat(value);
    if (!isNaN(numericValue) && value) {
      numericValue = normalizeInputPrice(numericValue);
      onSave(numericValue, selectedUnit);
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

  const numBtn = "bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 hover:text-white text-2xl font-medium rounded-xl transition-all active:scale-95 shadow-sm";
  const actionBtn = "bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white text-lg rounded-xl transition-all active:scale-95 shadow-sm";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center z-[60] p-4 pb-8 md:pb-4" onClick={onClose}>
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        
        <div className="flex justify-between items-center mb-4">
            <div className="w-8"></div> {/* Spacer for centering */}
            <h3 className="text-white font-semibold truncate flex-grow text-center px-2 text-sm text-cyan-300">Set Price: {item.name}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="0.00"
          className="w-full bg-gray-800 text-cyan-300 text-4xl font-mono text-right rounded-xl p-4 mb-4 outline-none focus:ring-2 focus:ring-cyan-500/50 border border-gray-700 placeholder-gray-600"
        />

        <div className="grid grid-cols-4 gap-3">
          {['1', '2', '3'].map(n => <button key={n} onClick={() => handleInput(n)} className={`${numBtn} aspect-square`}>{n}</button>)}
          <button onClick={handleBackspace} className={`${actionBtn} aspect-square text-yellow-500 hover:text-yellow-400`}>⌫</button>
          
          {['4', '5', '6'].map(n => <button key={n} onClick={() => handleInput(n)} className={`${numBtn} aspect-square`}>{n}</button>)}
          <button onClick={handleClear} className={`${actionBtn} aspect-square text-red-500 hover:text-red-400`}>C</button>
          
          {['7', '8', '9'].map(n => <button key={n} onClick={() => handleInput(n)} className={`${numBtn} aspect-square`}>{n}</button>)}
          
          <div className="relative aspect-square">
              <button ref={unitButtonRef} onClick={() => setIsUnitPickerOpen(prev => !prev)} className={`${actionBtn} w-full h-full text-sm font-bold text-gray-300 uppercase`}>
                  {selectedUnit || 'unit'}
              </button>
              {isUnitPickerOpen && (
                  <div ref={unitPickerRef} className="absolute bottom-full right-0 mb-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-1 z-10 max-h-60 w-32 overflow-y-auto hide-scrollbar">
                      <div className="grid grid-cols-1 gap-1">
                      {(Object.values(Unit) as Unit[]).map(u => (
                          <button key={u} onClick={() => handleUnitSelect(u)} className="px-3 py-2 text-sm text-left rounded-lg hover:bg-cyan-900/50 text-gray-200 hover:text-cyan-300 transition-colors">
                              {u}
                          </button>
                      ))}
                      </div>
                  </div>
              )}
          </div>
          
          <button onClick={() => handleInput('0')} className={`${numBtn} col-span-2`}>0</button>
          <button onClick={() => handleInput('.')} className={`${numBtn} aspect-square`}>.</button>
          <button onClick={handleSave} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xl font-bold rounded-xl aspect-square shadow-lg shadow-cyan-900/30 transition-all active:scale-95 flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PriceNumpadModal;