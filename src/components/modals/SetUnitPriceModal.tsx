import React, { useState, useEffect, useContext } from 'react';
// FIX: Correct import paths for modules based on the file's location.
import { Order, OrderItem } from '../../types';
import { AppContext } from '../../context/AppContext';

interface SetUnitPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: OrderItem | null;
  order: Order;
}

const SetUnitPriceModal: React.FC<SetUnitPriceModalProps> = ({ isOpen, onClose, item, order }) => {
    // FIX: Use `actions` from context instead of `dispatch` to ensure middleware (like Supabase calls) is triggered.
    const { actions } = useContext(AppContext);
    const [value, setValue] = useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && item) {
            setValue(item.price ? String(item.price) : '');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, item]);

    const handleInput = (char: string) => {
        if (char === '.' && value.includes('.')) return;
        if (value === '0' && char !== '.') setValue(char);
        else setValue(prev => prev + char);
    };

    const handleClear = () => setValue('');
    const handleBackspace = () => setValue(value.slice(0, -1));

    const handleSave = async () => {
        if (!item) return;
        const price = value.trim() === '' ? undefined : parseFloat(value);
        if (price !== undefined && (isNaN(price) || price < 0)) return;
        
        const updatedItems = order.items.map(i => 
            i.itemId === item.itemId && i.isSpoiled === item.isSpoiled ? { ...i, price } : i
        );
        
        await actions.updateOrder({ ...order, items: updatedItems });
        onClose();
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); await handleSave(); }
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
                <h3 className="text-lg font-bold text-white mb-2 text-center truncate">Set Price for {item?.name}</h3>
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-gray-900 text-white text-3xl font-mono text-right rounded-md p-3 mb-3 outline-none ring-2 ring-transparent focus:ring-indigo-500"
                />
                <div className="grid grid-cols-4 gap-2 text-xl">
                    {['1', '2', '3'].map(n => <button key={n} onClick={() => handleInput(n)} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 aspect-square flex items-center justify-center">{n}</button>)}
                    <button onClick={handleBackspace} className="p-3 bg-yellow-600 rounded-lg hover:bg-yellow-500 aspect-square flex items-center justify-center">⌫</button>
                    {['4', '5', '6'].map(n => <button key={n} onClick={() => handleInput(n)} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 aspect-square flex items-center justify-center">{n}</button>)}
                    <button onClick={handleClear} className="p-3 bg-red-600 rounded-lg hover:bg-red-500 aspect-square flex items-center justify-center">C</button>
                    {['7', '8', '9'].map(n => <button key={n} onClick={() => handleInput(n)} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 aspect-square flex items-center justify-center">{n}</button>)}
                    <div />
                    <button onClick={() => handleInput('0')} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 col-span-2">0</button>
                    <button onClick={() => handleInput('.')} className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 aspect-square flex items-center justify-center">.</button>
                    <button onClick={handleSave} className="p-3 bg-green-600 rounded-lg hover:bg-green-500 aspect-square flex items-center justify-center">OK</button>
                </div>
            </div>
        </div>
    );
};

export default SetUnitPriceModal;
