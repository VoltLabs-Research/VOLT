import { formatDistanceToNow } from 'date-fns';
import PopulatedCellPopover from '@/shared/presentation/components/PopulatedCellPopover';
import { StatusBadge } from '@/shared/presentation/primitives';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import type { User } from '@/modules/auth/api/entities/user';
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

interface UserColumnOptions<TRow> {
    width?: number;
    isFolder?: (row: TRow) => boolean;
};

interface ClusterColumnOptions<TRow> {
    width?: number;
    isFolder?: (row: TRow) => boolean;
    key?: string;
};

interface PopulatedNameColumnOptions<TRow> {
    width?: number;
    sortable?: boolean;
    isFolder?: (row: TRow) => boolean;
    modelName?: string;
};

interface EnumColumnOptions<TRow> {
    width?: number;
    sortable?: boolean;
    size?: 'default' | 'compact';
    resolveValue?: (value: unknown, row: TRow) => string;
    resolveLabel?: (value: string) => string;
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

const resolvePopulatedUser = (value: unknown): User | null => {
    if (!value || typeof value === 'string') {
        return null;
    }

    return value as User;
};

export function userColumn<TRow = unknown>(
    key: string,
    label: string,
    options?: UserColumnOptions<TRow>
): ColumnConfig<TRow> {
    return {
        key,
        title: label,
        sortable: false,
        render: (_value: unknown, row: TRow) => {
            if (options?.isFolder?.(row)) {
                return <span className='font-size-2 color-muted'>-</span>;
            }

            const user = resolvePopulatedUser((row as Record<string, unknown>)[key]);
            return (
                <PopulatedCellPopover document={user as Record<string, unknown> | null} modelName='User'>
                    <span className='font-size-2 color-secondary'>{user?.email ?? '-'}</span>
                </PopulatedCellPopover>
            );
        },
        skeleton: { variant: 'text', width: options?.width ?? 180 }
    };
}

const resolvePopulatedName = (value: unknown): string | null => {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        return null;
    }

    const populated = value as {
        email?: string;
        modifier?: { name?: string };
        name?: string;
        title?: string;
    };

    const resolvedName = populated.name?.trim()
        || populated.title?.trim()
        || populated.email?.trim()
        || populated.modifier?.name?.trim();

    return resolvedName || null;
};

export function clusterColumn<TRow = unknown>(
    options?: ClusterColumnOptions<TRow>
): ColumnConfig<TRow> {
    const key = options?.key ?? 'teamCluster';

    return {
        key,
        title: 'Cluster',
        sortable: false,
        render: (_value: unknown, row: TRow) => {
            if (options?.isFolder?.(row)) {
                return <span className='font-size-2 color-muted'>-</span>;
            }

            const rawValue = (row as Record<string, unknown>)[key];
            const cluster = (!rawValue || typeof rawValue === 'string') ? null : rawValue as Record<string, unknown>;
            const name = resolvePopulatedName(rawValue);

            const content = name
                ? <span className='font-size-2 color-secondary'>{name}</span>
                : <span className='font-size-2 color-muted'>-</span>;

            return (
                <PopulatedCellPopover document={cluster} modelName='TeamCluster'>
                    {content}
                </PopulatedCellPopover>
            );
        },
        skeleton: { variant: 'text', width: options?.width ?? 140 }
    };
}

export function populatedNameColumn<TRow = unknown>(
    key: string,
    label: string,
    options?: PopulatedNameColumnOptions<TRow>
): ColumnConfig<TRow> {
    const modelName = options?.modelName ?? label;

    return {
        key,
        title: label,
        sortable: options?.sortable ?? false,
        render: (_value: unknown, row: TRow) => {
            if (options?.isFolder?.(row)) {
                return <span className='font-size-2 color-muted'>-</span>;
            }

            const rawValue = (row as Record<string, unknown>)[key];
            const populated = (!rawValue || typeof rawValue === 'string') ? null : rawValue as Record<string, unknown>;
            const name = resolvePopulatedName(rawValue);

            const content = name
                ? <span className='font-size-2 color-secondary'>{name}</span>
                : <span className='font-size-2 color-muted'>-</span>;

            return (
                <PopulatedCellPopover document={populated} modelName={modelName}>
                    {content}
                </PopulatedCellPopover>
            );
        },
        skeleton: { variant: 'text', width: options?.width ?? 140 }
    };
}

/**
 * Column preset for generic enum fields.
 * Renders the cell value as a StatusBadge with automatic variant mapping.
 * Use `resolveLabel` to provide a human-friendly display label,
 * or `resolveValue` to transform the raw cell value before rendering.
 */
export function enumColumn<TRow = unknown>(
    key: string,
    label: string,
    options?: EnumColumnOptions<TRow>
): ColumnConfig<TRow> {
    return {
        key,
        title: label,
        sortable: options?.sortable ?? false,
        render: (value: unknown, row: TRow) => {
            const raw = options?.resolveValue ? options.resolveValue(value, row) : String(value ?? '');
            const displayLabel = options?.resolveLabel ? options.resolveLabel(raw) : undefined;
            return displayLabel
                ? <StatusBadge status={raw} size={options?.size}>{displayLabel}</StatusBadge>
                : <StatusBadge status={raw} size={options?.size} />;
        },
        skeleton: {
            variant: 'rounded',
            width: options?.width ?? 100,
            height: 24
        }
    };
}
