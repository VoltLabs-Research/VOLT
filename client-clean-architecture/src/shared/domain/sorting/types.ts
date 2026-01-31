export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
    key: string;
    direction: SortDirection;
};

export interface SortableValue {
    stringValue: string;
    numericValue?: number;
    isNumeric: boolean;
};
