
import { Order, SupplierName } from '../types';

export const sortOrdersDefault = (orders: Order[]) => {
    // Priority suppliers at the top
    const customSortOrder: string[] = [
        SupplierName.KALI, 
        'STOCK', 
        SupplierName.STOCK_OUT
    ];
    // Suppliers forced to the bottom
    const lastSupplier = SupplierName.PISEY;

    return [...orders].sort((a, b) => {
        const nameA = a.supplierName;
        const nameB = b.supplierName;

        // Handle "Last" supplier rule
        if (nameA === lastSupplier && nameB !== lastSupplier) return 1;
        if (nameB === lastSupplier && nameA !== lastSupplier) return -1;

        // Handle "First" supplier rules
        const indexA = customSortOrder.indexOf(nameA);
        const indexB = customSortOrder.indexOf(nameB);

        if (indexA > -1 && indexB > -1) return indexA - indexB;
        if (indexA > -1) return -1;
        if (indexB > -1) return 1;
        
        // Default alphabetical
        return nameA.localeCompare(nameB);
    });
};
