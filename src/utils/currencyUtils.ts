
/**
 * Normalizes an input price.
 * If the value is greater than 1000, it is assumed to be in Riel and converted to USD (divided by 4000).
 * Returns the normalized value.
 */
export const normalizeInputPrice = (value: number): number => {
    if (value > 1000) {
        return value / 4000;
    }
    return value;
};

/**
 * Formats a number as a standard price string (e.g., "12.50").
 */
export const formatPrice = (price: number): string => {
    return price.toFixed(2);
};
