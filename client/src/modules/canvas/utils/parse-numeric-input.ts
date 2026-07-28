const INCOMPLETE_NUMERIC_VALUES = new Set(['', '-', '+', '.', '-.', '+.']);

export const parseNumericInput = (value: string): number | null => {
    const normalizedValue = value.trim().replace(/,/g, '.');

    if (INCOMPLETE_NUMERIC_VALUES.has(normalizedValue)) {
        return null;
    }

    const parsedValue = Number(normalizedValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
};
