import { getValueByPath } from '@voltstack/bravais';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
    key: string;
    direction: SortDirection;
}

/**
 * Listing columns are addressed by a runtime string path, so a cell value can be
 * any JSON shape the server produced. Arrays are flattened because plugin
 * listings expose vector columns.
 */
const toComparableString = (value: unknown): string => {
    if(value == null) return '';
    if(Array.isArray(value)) return value.map(toComparableString).join(' ');

    return String(value);
};

const compareValues = (aValue: unknown, bValue: unknown, direction: SortDirection): number => {
    if(aValue == null && bValue == null) return 0;
    if(aValue == null) return direction === 'asc' ? -1 : 1;
    if(bValue == null) return direction === 'asc' ? 1 : -1;

    const aString = toComparableString(aValue);
    const bString = toComparableString(bValue);
    const aNumber = Number(aString);
    const bNumber = Number(bString);
    const comparison = Number.isNaN(aNumber) || Number.isNaN(bNumber)
        ? aString.localeCompare(bString)
        : aNumber - bNumber;

    return direction === 'asc' ? comparison : -comparison;
};

export const sortData = <T>(data: T[], sortConfig: SortConfig | null): T[] => {
    if(!sortConfig) return data;

    return [...data].sort((a, b) => compareValues(
        getValueByPath(a, sortConfig.key),
        getValueByPath(b, sortConfig.key),
        sortConfig.direction
    ));
};
