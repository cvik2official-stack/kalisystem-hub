import { Item, Unit, Supplier, SupplierName } from '../types';

// A simple CSV parser that assumes no quoted commas and case-insensitive headers.
const parseCsv = (csvText: string): Record<string, string>[] => {
    const lines = csvText.trim().replace(/\r\n/g, '\n').split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIndex = headers.indexOf('name');
    const supplierIndex = headers.indexOf('supplier');

    if (nameIndex === -1 || supplierIndex === -1) {
        throw new Error('CSV must contain "Name" and "Supplier" columns.');
    }

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= headers.length && values[nameIndex] && values[supplierIndex]) {
            const row: Record<string, string> = {};
            row['name'] = values[nameIndex];
            row['supplier'] = values[supplierIndex];
            rows.push(row);
        }
    }
    return rows;
};


export const processCsvContent = (
    csvText: string,
): { items: Item[], suppliers: Supplier[] } => {
    const parsedRows = parseCsv(csvText);
    const items: Item[] = [];
    const supplierSet = new Set<SupplierName>();
    
    // Get a set of valid supplier names from the enum for quick lookup
    const validSupplierNames = new Set<string>(Object.values(SupplierName));

    for (const row of parsedRows) {
        const itemName = row['name']?.trim();
        const supplierName = row['supplier']?.trim();

        if (!itemName || !supplierName || !validSupplierNames.has(supplierName)) {
            // Skip rows with missing data or suppliers not in our enum
            continue;
        }
        
        const supplierNameEnum = supplierName as SupplierName;
        supplierSet.add(supplierNameEnum);

        const newItem: Item = {
            id: `csv_${supplierNameEnum}_${itemName.replace(/\s+/g, '_')}`,
            name: itemName,
            supplierId: `sup_${supplierNameEnum}`, // Placeholder front-end ID
            supplierName: supplierNameEnum,
            unit: Unit.PC, // Default unit
        };
        items.push(newItem);
    }
    
    const suppliers: Supplier[] = Array.from(supplierSet).map(name => ({
        id: `sup_${name}`, // Placeholder front-end ID
        name
    }));

    return { items, suppliers };
};