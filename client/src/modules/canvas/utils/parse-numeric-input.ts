const INCOMPLETE_NUMERIC_VALUES = new Set(['', '-', '+', '.', '-.', '+.']);
const NUMERIC_DRAFT_PATTERN = /^[+-]?\d*\.?\d*(?:e[+-]?\d*)?$/i;
const TRAILING_SIGN_PATTERN = /^([+-]?)(\d*\.?\d*)([+-])$/;

const normalizeDecimalSeparators = (value: string): string => value.trim().replace(/,/g, '.');

export const parseNumericInput = (value: string): number | null => {
    const normalizedValue = normalizeDecimalSeparators(value);

    if (INCOMPLETE_NUMERIC_VALUES.has(normalizedValue)) {
        return null;
    }

    const parsedValue = Number(normalizedValue);
    if (!Number.isFinite(parsedValue)) {
        return null;
    }

    return parsedValue === 0 ? 0 : parsedValue;
};

export const resolveNumericInputDraft = (value: string): string | null => {
    const draft = value.trim();
    const normalizedDraft = normalizeDecimalSeparators(draft);

    if (NUMERIC_DRAFT_PATTERN.test(normalizedDraft)) {
        return draft;
    }

    const trailingSignMatch = TRAILING_SIGN_PATTERN.exec(normalizedDraft);
    if (!trailingSignMatch) {
        return null;
    }

    const [, leadingSign, digits, typedSign] = trailingSignMatch;
    if (typedSign === '+') {
        return digits;
    }

    if (leadingSign === '-') {
        return digits;
    }

    return digits === '0' ? '-' : `-${digits}`;
};
