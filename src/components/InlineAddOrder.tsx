
import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { StoreName, QuickOrder } from '../types';

interface InlineAddOrderProps { 
    onAddSupplier: () => void;
    onPasteList: () => void;
    onSelectItem: () => void;
    onQuickOrder: (qo: QuickOrder) => void;
    onStaffFood?: () => void;
}

const InlineAddOrder: React.FC<InlineAddOrderProps> = ({ onAddSupplier, onPasteList, onSelectItem, onQuickOrder, onStaffFood }) => {
    const { state } = useContext(AppContext);
    const { activeStore, quickOrders } = state;

    if (activeStore === 'Settings' || activeStore === 'ALL') { return null; }

    const storeQuickOrders = quickOrders.filter(qo => qo.store === activeStore);
    const isStaffFoodEnabled = activeStore === StoreName.SHANTI || activeStore === StoreName.WB;

    return (
        <div className="bg-gray-800 rounded-xl shadow-lg flex flex-col border-2 border-dashed border-gray-700 items-center justify-center p-4 w-full max-w-sm mx-auto my-4 transition-all hover:border-gray-600">
            <div className="flex flex-col space-y-3 w-full">
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={onAddSupplier} className="flex items-center justify-center text-indigo-400 hover:text-white hover:bg-indigo-600 font-semibold transition-all text-sm py-3 px-2 rounded-lg border border-indigo-500/30 hover:border-indigo-500 shadow-sm">
                        <span className="mr-1 text-lg">+</span> Supplier
                    </button>
                    <button onClick={onSelectItem} className="flex items-center justify-center text-indigo-400 hover:text-white hover:bg-indigo-600 font-semibold transition-all text-sm py-3 px-2 rounded-lg border border-indigo-500/30 hover:border-indigo-500 shadow-sm">
                        <span className="mr-1 text-lg">+</span> Item
                    </button>
                </div>
                
                <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-gray-700"></div>
                    <span className="flex-shrink-0 mx-2 text-gray-600 text-[10px] font-bold uppercase tracking-widest">OR</span>
                    <div className="flex-grow border-t border-gray-700"></div>
                </div>

                <button onClick={onPasteList} className="text-gray-400 hover:text-white hover:bg-gray-700 font-medium transition-colors text-sm py-2 px-4 rounded-lg w-full border border-gray-600 hover:border-gray-500">
                    Paste a List
                </button>
                
                {isStaffFoodEnabled && onStaffFood && (
                    <button onClick={onStaffFood} className="text-pink-400 hover:text-white hover:bg-pink-600 font-medium transition-colors text-sm py-2 px-4 rounded-lg w-full border border-pink-500/30 hover:border-pink-500">
                        Paste Staff Food List
                    </button>
                )}

                {storeQuickOrders.length > 0 && (
                    <div className="pt-2">
                        <div className="flex items-center mb-2">
                             <div className="h-px bg-gray-700 flex-grow"></div>
                             <span className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Quick Orders</span>
                             <div className="h-px bg-gray-700 flex-grow"></div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {storeQuickOrders.map(qo => (
                                <button key={qo.id} onClick={() => onQuickOrder(qo)} className="bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white text-xs py-2 px-3 rounded border border-gray-700 hover:border-gray-500 transition-all flex items-center justify-between group">
                                    <span className="font-medium truncate">{qo.name}</span>
                                    <span className="text-[10px] text-gray-500 group-hover:text-gray-400">{qo.supplierName}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InlineAddOrder;
