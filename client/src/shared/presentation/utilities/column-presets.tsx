import { formatDistanceToNow } from 'date-fns';
import PopulatedCellPopover from '@/shared/presentation/components/PopulatedCellPopover';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Container from '@/shared/presentation/components/Container';
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
};

interface PopulatedNameColumnOptions<TRow> {
    width?: number;
    sortable?: boolean;
    isFolder?: (row: TRow) => boolean;
    modelName?: string;
};

interface TitleWithIconColumnOptions {
    width?: number;
    sortable?: boolean;
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
        return value;
    }

    const populated = value as { _id: string; name?: string };
    return populated.name || populated._id;
};

export function clusterColumn<TRow = unknown>(
    options?: ClusterColumnOptions<TRow>
): ColumnConfig<TRow> {
    return {
        key: 'teamCluster',
        title: 'Cluster',
        sortable: false,
        render: (_value: unknown, row: TRow) => {
            if (options?.isFolder?.(row)) {
                return <span className='font-size-2 color-muted'>-</span>;
            }

            const rawValue = (row as Record<string, unknown>).teamCluster;
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

export function titleWithIconColumn<TRow = unknown>(
    key: string,
    label: string,
    icon: ReactNode,
    resolveTitle: (row: TRow) => string,
    options?: TitleWithIconColumnOptions
): ColumnConfig<TRow> {
    return {
        key,
        title: label,
        sortable: options?.sortable ?? true,
        render: (_value: unknown, row: TRow) => (
            <Container className='d-flex items-center gap-075'>
                <Container className='d-flex flex-center color-primary'>
                    {icon}
                </Container>
                <span className='font-weight-6 color-primary text-truncate'>{resolveTitle(row)}</span>
            </Container>
        ),
        skeleton: { variant: 'text', width: options?.width ?? 180 }
    };
}
