import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';

export function dateColumn(
    key: string,
    label: string,
    options?: { width?: number; sortable?: boolean }
): ColumnConfig {
    return {
        key,
        title: label,
        sortable: options?.sortable ?? true,
        width: options?.width,
        render: (value: unknown) =>
            value ? formatDistanceToNow(new Date(value as string), { addSuffix: true }) : '-',
        skeleton: { variant: 'text', width: options?.width ?? 100 }
    };
}

export function statusColumn(
    key: string,
    label: string,
    options?: { width?: number; sortable?: boolean }
): ColumnConfig {
    return {
        key,
        title: label,
        sortable: options?.sortable ?? true,
        width: options?.width,
        render: (value: unknown) => <StatusBadge status={String(value)} />,
        skeleton: { variant: 'rounded', width: options?.width ?? 80, height: 24 }
    };
}
