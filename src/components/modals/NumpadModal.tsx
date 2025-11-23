
import React, { useState, useEffect, useRef } from 'react';
import { OrderItem, Unit } from '../../types';

interface NumpadModalProps {
  item: OrderItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (quantity: number, unit?: Unit) => void;
  onDelete: () => void;
  onSwitchToPrice?: () => void;
}

const UNIT_MAPPING: { key: string; unit: Unit }[] = [
    { key: '1', unit: Unit.KG },
    { key: '2', unit: Unit.PC },
    { key: '3', unit: Unit.L },
    { key: '4', unit: Unit.BOX },
    { key: '5', unit: Unit.PK },
    { key: '6', unit: Unit.BT },
    { key: '7', unit: Unit.CAN },
    { key: '8', unit: Unit.ROLL },
    { key: '9', unit: Unit.BLOCK },
    { key: '0', unit: Unit.GLASS },
];

const NumpadModal: React.FC<NumpadModalProps> = ({ item, isOpen, onClose, onSave, onDelete, onSwitchToPrice }) => {
  const [value, setValue] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit | undefined>(undefined);
  const [isUnitMode, setIsUnitMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue('');
      setSelectedUnit(item.unit);
      setIsUnitMode(false);
      // Small delay to ensure render
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, item]);

  const handleInput = (char: string) => {
    if (isUnitMode) {
        // In unit mode, number keys select units
        const mapping = UNIT_MAPPING.find(m => m.key === char);
        if (mapping) {
            setSelectedUnit(mapping.unit);
            setIsUnitMode(false); // Auto-switch back after selection
        }
        return;
    }

    if (char === '.') {
      if (value === '' && onSwitchToPrice) {
        onSwitchToPrice();
        return;
      }
      if (value.includes('.')) return;
    }
    
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
      onSave(item.quantity, selectedUnit);
    }
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
    
    // Map physical number keys to unit selection if in unit mode
    if (isUnitMode && /^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleInput(e.key);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === "" || /^[0-9]*\.?[0-9]*$/.test(rawValue)) {
      setValue(rawValue);
    }
  };

  if (!isOpen) return null;

  // Styles
  const btnBase = "relative rounded-xl shadow-sm transition-all active:scale-95 flex flex-col items-center justify-center overflow-hidden border border-gray-700";
  const numBtn = `${btnBase} bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white text-2xl font-medium`;
  const unitBtn = `${btnBase} bg-indigo-900/40 text-indigo-200 hover:bg-indigo-800/50 border-indigo-500/30`;
  const actionBtn = `${btnBase} bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white text-lg`;

  const renderKey = (num: string) => {
      if (isUnitMode) {
          const mapping = UNIT_MAPPING.find(m => m.key === num);
          return (
              <button 
                key={num} 
                onClick={() => handleInput(num)} 
                className={`${unitBtn} aspect-square`}
              >
                  <span className="text-xs font-bold opacity-50 absolute top-1 left-2">{num}</span>
                  <span className="text-sm font-bold uppercase tracking-wider">{mapping?.unit}</span>
              </button>
          );
      }
      return (
        <button key={num} onClick={() => handleInput(num)} className={`${numBtn} aspect-square`}>
            {num}
        </button>
      );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center z-[60] p-4 pb-8 md:pb-4" onClick={onClose}>
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
            <button onClick={handleDelete} className="text-red-500 hover:text-red-400 p-2 rounded-full hover:bg-gray-800 transition-colors" title="Delete Item">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
            </button>
            <div className="flex flex-col items-center justify-center flex-grow px-2 overflow-hidden">
                <h3 className="text-white font-semibold truncate w-full text-center">{item.name}</h3>
                {selectedUnit && (
                    <span className="text-xs text-indigo-300 font-mono mt-0.5">{selectedUnit}</span>
                )}
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        
        {/* Display */}
        <input
          ref={inputRef}
          type="text"
          inputMode="none" // Disable native keyboard on mobile to use custom numpad
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={item.quantity.toString()}
          className="w-full bg-gray-800 text-white text-4xl font-mono text-right rounded-xl p-4 mb-4 outline-none focus:ring-2 focus:ring-indigo-500/50 border border-gray-700 placeholder-gray-600"
        />

        {/* Keypad */}
        <div className="grid grid-cols-4 gap-3">
          {['1', '2', '3'].map(renderKey)}
          <button onClick={handleBackspace} className={`${actionBtn} aspect-square text-yellow-500 hover:text-yellow-400`}>⌫</button>

          {['4', '5', '6'].map(renderKey)}
          <button onClick={handleClear} className={`${actionBtn} aspect-square text-red-500 hover:text-red-400`}>C</button>
          
          {['7', '8', '9'].map(renderKey)}
          
          {/* Unit Toggle Button */}
          <button 
            onClick={() => setIsUnitMode(!isUnitMode)} 
            className={`${actionBtn} aspect-square ${isUnitMode ? 'bg-indigo-600 text-white border-indigo-500' : ''}`}
          >
            <span className="text-xs font-bold uppercase tracking-wider">{selectedUnit || 'UNIT'}</span>
          </button>
          
          {/* Bottom Row - 0 Key */}
          {isUnitMode ? (
              <button 
                onClick={() => handleInput('0')} 
                className={`${unitBtn} col-span-2`}
              >
                  <span className="text-xs font-bold opacity-50 absolute top-1 left-2">0</span>
                  <span className="text-sm font-bold uppercase tracking-wider">{UNIT_MAPPING.find(m => m.key === '0')?.unit}</span>
              </button>
          ) : (
              <button onClick={() => handleInput('0')} className={`${numBtn} col-span-2`}>
                  0
              </button>
          )}
          
          {/* Dot / Price Switch */}
          <button onClick={() => handleInput('.')} className={`${numBtn} aspect-square relative`}>
             .
             {value === '' && onSwitchToPrice && (
                 <div className="absolute inset-0 flex items-center justify-center bg-gray-800/90 text-[10px] text-cyan-300 font-bold uppercase tracking-wider opacity-0 hover:opacity-100 transition-opacity">
                     Price
                 </div>
             )}
          </button>

          <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-bold rounded-xl aspect-square shadow-lg shadow-indigo-900/30 transition-all active:scale-95 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NumpadModal;
