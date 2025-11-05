import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { OrderItem, OrderStatus, PaymentMethod, Supplier } from '../types';
import AddSupplierModal from './modals/AddSupplierModal';

interface AggregatedItem extends OrderItem {
  uniqueId: string;
}

const KaliPatchingView: React.FC = () => {
    const { state } = useContext(AppContext);
    const { orders, suppliers } = state;

    const initialPatchingItems = useMemo(() => {
        const kaliOnTheWayOrders = orders.filter(order => {
            const supplier = suppliers.find(s => s.id === order.supplierId);
            return supplier?.paymentMethod === PaymentMethod.KALI && order.status === OrderStatus.ON_THE_WAY;
        });

        const allItems = kaliOnTheWayOrders.flatMap(order => 
            order.items.map((item, index) => ({
                ...item,
                uniqueId: `${item.itemId}-${order.id}-${index}` // Create a unique ID for each item instance
            }))
        );
        return allItems;
    }, [orders, suppliers]);

    const [patchingItems, setPatchingItems] = useState<AggregatedItem[]>(initialPatchingItems);
    const [zoneItems, setZoneItems] = useState<Record<string, AggregatedItem[]>>({
        'Zone 1': [], 'Zone 2': [], 'Zone 3': [], 'Zone 4': [],
    });
    const [draggedItem, setDraggedItem] = useState<AggregatedItem | null>(null);
    
    const [isPatchingComplete, setIsPatchingComplete] = useState(false);
    const [zoneSuppliers, setZoneSuppliers] = useState<Record<string, Supplier[]>>({});
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [activeZoneForModal, setActiveZoneForModal] = useState<string | null>(null);


    const handleDragStart = (item: AggregatedItem) => {
        setDraggedItem(item);
    };

    const handleDrop = (zone: string) => {
        if (!draggedItem) return;
        setPatchingItems(prev => prev.filter(item => item.uniqueId !== draggedItem.uniqueId));
        setZoneItems(prev => ({
            ...prev,
            [zone]: [...prev[zone], draggedItem],
        }));
        setDraggedItem(null);
    };
    
    // Check for completion after every drop
    React.useEffect(() => {
        if (initialPatchingItems.length > 0 && patchingItems.length === 0 && !isPatchingComplete) {
            setIsPatchingComplete(true);
        }
    }, [patchingItems, initialPatchingItems.length, isPatchingComplete]);

    const handleAddSupplierClick = (zone: string) => {
        setActiveZoneForModal(zone);
        setIsSupplierModalOpen(true);
    };
    
    const handleSelectSupplier = (supplier: Supplier) => {
        if (activeZoneForModal) {
            setZoneSuppliers(prev => {
                const existingSuppliers = prev[activeZoneForModal] || [];
                // Avoid adding duplicates
                if (existingSuppliers.some(s => s.id === supplier.id)) {
                    return prev;
                }
                return {
                    ...prev,
                    [activeZoneForModal]: [...existingSuppliers, supplier]
                };
            });
        }
        setIsSupplierModalOpen(false);
        setActiveZoneForModal(null);
    };


    if (!isPatchingComplete) {
        return (
            <div className="flex-grow pt-4 grid grid-cols-2 gap-6 h-full">
                {/* Patching Card */}
                <div className="bg-gray-800 rounded-xl shadow-lg flex flex-col p-4">
                    <h3 className="font-bold text-white text-lg mb-2">Patching</h3>
                    <div className="flex-grow overflow-y-auto hide-scrollbar space-y-1">
                        {patchingItems.map(item => (
                            <div
                                key={item.uniqueId}
                                draggable
                                onDragStart={() => handleDragStart(item)}
                                className="flex items-center p-2 bg-gray-700 rounded-md cursor-grab active:cursor-grabbing"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>
                                <span className="text-gray-300">{item.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Zones Column */}
                <div className="space-y-4">
                    {['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4'].map(zone => (
                        <div
                            key={zone}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(zone)}
                            className="bg-gray-800 rounded-xl shadow-lg p-3 border-2 border-dashed border-gray-700 min-h-[4rem]"
                        >
                            <h4 className="font-semibold text-white">{zone}</h4>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    
    const allSuppliersInMap = Object.values(zoneSuppliers).flat();

    return (
        <div className="flex-grow pt-4 flex h-full">
            {/* Mind Map Column */}
            <div className="w-2/3 pr-4 space-y-6">
                {Object.entries(zoneItems).map(([zoneName, items]) => {
                    if (items.length === 0) return null;
                    const uniqueItemCount = new Set(items.map(i => i.itemId)).size;
                    const suppliersForZone = zoneSuppliers[zoneName] || [];

                    return (
                        <div key={zoneName} className="flex items-start space-x-4">
                            {/* Bubble */}
                            <button onClick={() => handleAddSupplierClick(zoneName)} className="flex-shrink-0 flex flex-col items-center justify-center bg-indigo-600 h-20 w-20 rounded-full shadow-lg text-white hover:bg-indigo-700">
                                <span className="font-bold text-xl">{uniqueItemCount}</span>
                                <span className="text-xs">items</span>
                            </button>
                            {/* Supplier Links */}
                            <div className="flex flex-col space-y-2 pt-2">
                                <span className="text-sm font-semibold text-gray-400">{zoneName}</span>
                                {suppliersForZone.map(supplier => (
                                    <div key={supplier.id} className="bg-gray-700 px-3 py-1 rounded-full text-sm text-gray-200">
                                        {supplier.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Tracking Column */}
            <div className="w-1/3 border-l border-gray-700 pl-4">
                <div className="relative h-full">
                    <div className="absolute top-0 left-1/2 -ml-2">
                        <div className="relative w-4 h-4">
                            <div className="absolute inset-0 bg-red-500 rounded-full animate-sonar-pulse"></div>
                            <div className="absolute inset-1 bg-red-500 rounded-full"></div>
                        </div>
                    </div>
                     <div className="pt-12 space-y-16">
                        {allSuppliersInMap.map((supplier, index) => (
                             <div key={`${supplier.id}-${index}`} className="relative h-4 flex items-center">
                                 <div className="w-2 h-2 bg-gray-600 rounded-full absolute left-1/2 -ml-1"></div>
                             </div>
                        ))}
                    </div>
                </div>
            </div>
            
             <AddSupplierModal
                isOpen={isSupplierModalOpen}
                onClose={() => setIsSupplierModalOpen(false)}
                onSelect={handleSelectSupplier}
                title={`Link Supplier to ${activeZoneForModal}`}
            />
        </div>
    );
};

export default KaliPatchingView;