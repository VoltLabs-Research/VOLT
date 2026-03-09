import { formatDistanceToNow } from 'date-fns';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import type { ReactNode } from 'react';

interface DateColumnOptions {
    width?: number;
    sortable?: boolean;
    fallback?: ReactNode;
    withTitle?: boolean;
};

interface StatusColumnOptions<TRow> {
    width?: number;
    sortable?: boolean;
    resolveStatus?: (value: unknown, row: TRow) => string;
};

export function dateColumn<TRow = unknown>(
    key: string,
    label: string,
    options?: DateColumnOptions
): ColumnConfig<TRow> {
    return {
        key,
        title: label,
        sortable: options?.sortable ?? true,
        width: options?.width,
        render: (value: unknown) => {
            if (!value) {
                return options?.fallback ?? '-';
            }

            const date = new Date(String(value));
            const formatted = formatDistanceToNow(date, { addSuffix: true });
            if (!options?.withTitle) {
                return formatted;
            }

            return <span title={date.toLocaleString()}>{formatted}</span>;
        },
        skeleton: { variant: 'text', width: options?.width ?? 100 }
    };
}

export function statusColumn<TRow = unknown>(
    key: string,
    label: string,
    options?: StatusColumnOptions<TRow>
): ColumnConfig<TRow> {
    return {
        key,
        title: label,
        sortable: options?.sortable ?? false,
        render: (value: unknown, row: TRow) => {
            const status = options?.resolveStatus ? options.resolveStatus(value, row) : String(value);
            return <StatusBadge status={status} />;
        },
        skeleton: {
            variant: 'rounded',
            width: options?.width ?? 80,
            height: 24
        }
    };
}
