import { Item, ParsedItem, Unit } from '../types';

const findBestMatch = (searchText: string, items: Item[]): Item | null => {
    if (!searchText) return null;

    // Normalize by lowercasing and removing spaces. This is key for "bell pepper" vs "bellpepper"
    const normalizedSearchText = searchText.toLowerCase().replace(/\s+/g, '');
    const searchWords = new Set(searchText.toLowerCase().split(' ').filter(w => w.length > 1));
    let bestMatch: Item | null = null;
    let highestScore = 0;

    for (const item of items) {
        const itemNameLower = item.name.toLowerCase();
        const normalizedItemName = itemNameLower.replace(/\s+/g, '');

        // 1. If normalized names match perfectly, it's a very confident match.
        if (normalizedItemName === normalizedSearchText) {
            return item;
        }

        let score = 0;

        // 2. Score based on matching individual words
        for (const word of searchWords) {
            if (itemNameLower.includes(word)) {
                score++;
            }
        }
        
        // 3. Add a bonus for a full substring match, as it's a strong signal.
        if (itemNameLower.includes(searchText.toLowerCase())) {
            score += 2;
        }

        if (score > highestScore) {
            highestScore = score;
            bestMatch = item;
        }
    }

    // 4. Use a stricter threshold to avoid weak matches.
    // Requires more than one matching word, or a full substring match, etc.
    if (highestScore > 1) {
        return bestMatch;
    }

    return null;
};

const extractQuantityAndUnit = (line: string): { quantity: number; unit?: Unit; remainingLine: string } => {
    const unitSynonyms: { [key: string]: Unit } = {
        'bottle': Unit.BT, 'bottles': Unit.BT, 'btl': Unit.BT,
        'pack': Unit.PK, 'packs': Unit.PK, 'pax': Unit.PK,
        'liter': Unit.L, 'liters': Unit.L, 'litre': Unit.L, 'litres': Unit.L,
        'pc': Unit.PC, 'pcs': Unit.PC, 'piece': Unit.PC, 'pieces': Unit.PC,
        'kg': Unit.KG, 'kilo': Unit.KG, 'kilos': Unit.KG,
        'box': Unit.BOX, 'boxes': Unit.BOX,
        'case': Unit.CASE, 'cases': Unit.CASE,
        'ctn': Unit.CTN, 'carton': Unit.CTN, 'cartons': Unit.CTN,
        'can': Unit.CAN, 'cans': Unit.CAN,
        'roll': Unit.ROLL, 'rolls': Unit.ROLL,
        'block': Unit.BLOCK, 'blocks': Unit.BLOCK,
        'jar': Unit.JAR, 'jars': Unit.JAR,
        'glass': Unit.GLASS,
    };
    
    // Create a regex pattern from all known unit names and synonyms
    const allUnitKeys = [...new Set([...Object.values(Unit), ...Object.keys(unitSynonyms)])];
    const unitsPattern = `(?:${allUnitKeys.join('|')})`;

    let quantity: number = 1;
    let unit: Unit | undefined = undefined;
    let remainingLine = ` ${line} `; // Pad with spaces for easier regex matching at edges

    // 1. Handle "0 3 kg" -> "0.3kg" case first, as it's very specific and avoids ambiguity
    const spacedDecimalRegex = new RegExp(`\\b(0)[\\s,.]+(\\d+)\\s*(${unitsPattern})\\b`, 'i');
    let match = remainingLine.match(spacedDecimalRegex);
    
    if (match) {
        // We found a pattern like "0 5 kg", convert it to 0.5 kg
        quantity = parseFloat(`${match[1]}.${match[2]}`);
        const unitStr = match[3].toLowerCase();
        unit = unitSynonyms[unitStr] || unitStr as Unit;
        remainingLine = remainingLine.replace(match[0], ' ');
    } else {
        // 2. Look for number and unit together (e.g., "2kg", "0.5 L", "1 bottle")
        const qtyAndUnitRegex = new RegExp(`(\\d*[,.]?\\d+)\\s*(${unitsPattern})\\b`, 'i');
        match = remainingLine.match(qtyAndUnitRegex);
        if (match) {
            const qtyStr = match[1].replace(',', '.');
            quantity = parseFloat(qtyStr);
            const unitStr = match[2].toLowerCase();
            unit = unitSynonyms[unitStr] || unitStr as Unit;
            remainingLine = remainingLine.replace(match[0], ' ');
        } else {
            // 3. Look for 'x' notation (e.g., "x5", "5x")
            const xNotationRegex = /(?:[xX]\s*(\d*[,.]?\\d+)|(\d*[,.]?\\d+)\s*[xX])/;
            match = remainingLine.match(xNotationRegex);
            if (match) {
                const qtyStr = (match[1] || match[2]).replace(',', '.');
                quantity = parseFloat(qtyStr);
                remainingLine = remainingLine.replace(match[0], ' ');
            } else {
                // 4. Look for a standalone number, prioritizing start/end
                const qtyAtEndRegex = /\s(\d*[,.]?\\d+)\s*$/;
                match = remainingLine.match(qtyAtEndRegex);
                if (match) {
                    const qtyStr = match[1].replace(',', '.');
                    quantity = parseFloat(qtyStr);
                    remainingLine = remainingLine.replace(match[0], ' ');
                } else {
                    const qtyAtStartRegex = /^\s*(\d*[,.]?\\d+)\s/;
                    match = remainingLine.match(qtyAtStartRegex);
                    if (match) {
                        const qtyStr = match[1].replace(',', '.');
                        quantity = parseFloat(qtyStr);
                        remainingLine = remainingLine.replace(match[0], ' ');
                    }
                }
            }
        }
    }

    // 5. If we haven't found a unit yet, look for one on its own. This is a final catch-all.
    if (!unit) {
        const unitOnlyRegex = new RegExp(`\\b(${unitsPattern})\\b`, 'i');
        match = remainingLine.match(unitOnlyRegex);
        if (match) {
            const unitStr = match[1].toLowerCase();
            unit = unitSynonyms[unitStr] || unitStr as Unit;
            remainingLine = remainingLine.replace(match[0], ' ');
        }
    }

    return { quantity, unit, remainingLine: remainingLine.trim() };
};

export const parseItemListLocally = async (text: string, existingItems: Item[]): Promise<ParsedItem[]> => {
    const lines = text.trim().split('\n').filter(line => line.trim() !== '');
    const parsedItems: ParsedItem[] = [];
    // Map to track duplicates: key is matchedItemId or lowercased newItemName, value is the index in parsedItems
    const duplicateTracker = new Map<string, number>();

    for (const line of lines) {
        if (!line) continue;

        const { quantity, unit, remainingLine } = extractQuantityAndUnit(line);
        
        const itemNameSearch = remainingLine.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

        if (itemNameSearch) {
             const matchedItem = findBestMatch(itemNameSearch, existingItems);

            if (matchedItem) {
                const key = matchedItem.id;
                if (duplicateTracker.has(key)) {
                    // It's a duplicate, update quantity
                    const existingIndex = duplicateTracker.get(key)!;
                    parsedItems[existingIndex].quantity += quantity;
                } else {
                    // It's a new item in this batch
                    const newIndex = parsedItems.length;
                    parsedItems.push({
                        matchedItemId: matchedItem.id,
                        quantity: quantity,
                        // For matched items, ALWAYS use the unit from the database, ignoring any parsed unit.
                        unit: matchedItem.unit,
                    });
                    duplicateTracker.set(key, newIndex);
                }
            } else {
                // New item not in the database
                const key = itemNameSearch.toLowerCase();
                 if (duplicateTracker.has(key)) {
                    // It's a duplicate of a new item within this batch, update quantity
                    const existingIndex = duplicateTracker.get(key)!;
                    parsedItems[existingIndex].quantity += quantity;
                } else {
                    // It's a new item in this batch
                    const newIndex = parsedItems.length;
                    parsedItems.push({
                        newItemName: itemNameSearch,
                        quantity: quantity,
                        unit: unit,
                    });
                    duplicateTracker.set(key, newIndex);
                }
            }
        }
    }

    return parsedItems;
};