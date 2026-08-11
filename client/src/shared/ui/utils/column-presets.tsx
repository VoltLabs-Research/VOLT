import { formatDistanceToNow } from 'date-fns';
import PopulatedCellPopover from '@/shared/ui/components/PopulatedCellPopover';
import { resolveStatusVariant } from '@/shared/ui/status-vocabulary';
import { cn } from '@heroui/react';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { User } from '@volt/contracts/modules/auth/domain';
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
        skeleton: {
            variant: 'text',
            width: options?.width ?? 100
        }
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
            return (
                <span className={cn('inline-flex items-center gap-1 rounded-full text-xs font-medium uppercase whitespace-nowrap', {
                    active: 'text-foreground',
                    brand: 'text-foreground',
                    primary: 'text-foreground',
                    success: 'text-success',
                    warning: 'text-warning',
                    danger: 'text-danger',
                    inactive: 'text-muted',
                    neutral: 'text-muted'
                }[resolveStatusVariant(status)])}>{status}</span>
            );
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
                return <span className='text-sm text-muted'>-</span>;
            }

            const user = resolvePopulatedUser((row as Record<string, unknown>)[key]);
            return (
                <PopulatedCellPopover document={user} modelName='User'>
                    <span className='text-sm text-muted'>{user?.email ?? '-'}</span>
                </PopulatedCellPopover>
            );
        },
        skeleton: {
            variant: 'text',
            width: options?.width ?? 180
        }
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
                return <span className='text-sm text-muted'>-</span>;
            }

            const rawValue = (row as Record<string, unknown>)[key];
            const cluster = (!rawValue || typeof rawValue === 'string') ? null : rawValue as Record<string, unknown>;
            const name = resolvePopulatedName(rawValue);

            const content = name
                ? <span className='text-sm text-muted'>{name}</span>
                : <span className='text-sm text-muted'>-</span>;

            return (
                <PopulatedCellPopover document={cluster} modelName='TeamCluster'>
                    {content}
                </PopulatedCellPopover>
            );
        },
        skeleton: {
            variant: 'text',
            width: options?.width ?? 140
        }
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
                return <span className='text-sm text-muted'>-</span>;
            }

            const rawValue = (row as Record<string, unknown>)[key];
            const populated = (!rawValue || typeof rawValue === 'string') ? null : rawValue as Record<string, unknown>;
            const name = resolvePopulatedName(rawValue);

            const content = name
                ? <span className='text-sm text-muted'>{name}</span>
                : <span className='text-sm text-muted'>-</span>;

            return (
                <PopulatedCellPopover document={populated} modelName={modelName}>
                    {content}
                </PopulatedCellPopover>
            );
        },
        skeleton: {
            variant: 'text',
            width: options?.width ?? 140
        }
    };
}

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
            return (
                <span className={cn('inline-flex items-center gap-1 rounded-full text-xs font-medium uppercase whitespace-nowrap', {
                    active: 'text-foreground',
                    brand: 'text-foreground',
                    primary: 'text-foreground',
                    success: 'text-success',
                    warning: 'text-warning',
                    danger: 'text-danger',
                    inactive: 'text-muted',
                    neutral: 'text-muted'
                }[resolveStatusVariant(raw)])}>{displayLabel ?? raw}</span>
            );
        },
        skeleton: {
            variant: 'rounded',
            width: options?.width ?? 100,
            height: 24
        }
    };
}
