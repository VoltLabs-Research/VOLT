import type { ReactNode } from 'react';

export type ListingDensity = 'default' | 'compact';

export interface ColumnConfig<TRow = unknown> {
    key?: string;
    title?: string;
    path?: string;
    label?: string;

    width?: number;

    minWidth?: number;

    flex?: number;

    numeric?: boolean;

    defaultHidden?: boolean;
    headerTitleClassName?: string;
    render?: (value: unknown, row: TRow) => ReactNode;
    skeleton?: { variant: 'text' | 'rounded'; width: number; height?: number };
    sortable?: boolean;
};

export const getColumnKey = <TRow,>(col: ColumnConfig<TRow>): string => col.key ?? col.path ?? '';

export const getColumnTitle = <TRow,>(col: ColumnConfig<TRow>): string => (
    col.title ?? col.label ?? col.key ?? col.path ?? ''
);