import { Order } from '../types';

export const sortOrdersDefault = (orders: Order[]) => {
    const customSortOrder: string[] = ['KALI', 'STOCK'];
    const lastSupplier = 'PISEY';

    return [...orders].sort((a, b) => {
        const nameA = a.supplierName;
        const nameB = b.supplierName;

        if (nameA === lastSupplier && nameB !== lastSupplier) return 1;
        if (nameB === lastSupplier && nameA !== lastSupplier) return -1;

        const indexA = customSortOrder.indexOf(nameA);
        const indexB = customSortOrder.indexOf(nameB);

        if (indexA > -1 && indexB > -1) return indexA - indexB;
        if (indexA > -1) return -1;
        if (indexB > -1) return 1;
        
        return nameA.localeCompare(nameB);
    });
};