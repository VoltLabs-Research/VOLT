import { formatDistanceToNow } from 'date-fns';
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

