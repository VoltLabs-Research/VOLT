import { formatDistanceToNow } from 'date-fns';
import ListingUserCell from '@/shared/presentation/components/ListingUserCell';
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
    showAvatar?: boolean;
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
            return <ListingUserCell user={user} showAvatar={options?.showAvatar ?? false} />;
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

            const name = resolvePopulatedName((row as Record<string, unknown>).teamCluster);
            if (!name) {
                return <span className='font-size-2 color-muted'>-</span>;
            }

            return <span className='font-size-2 color-secondary'>{name}</span>;
        },
        skeleton: { variant: 'text', width: options?.width ?? 140 }
    };
}

export function populatedNameColumn<TRow = unknown>(
    key: string,
    label: string,
    options?: PopulatedNameColumnOptions<TRow>
): ColumnConfig<TRow> {
    return {
        key,
        title: label,
        sortable: options?.sortable ?? false,
        render: (_value: unknown, row: TRow) => {
            if (options?.isFolder?.(row)) {
                return <span className='font-size-2 color-muted'>-</span>;
            }

            const name = resolvePopulatedName((row as Record<string, unknown>)[key]);
            if (!name) {
                return <span className='font-size-2 color-muted'>-</span>;
            }

            return <span className='font-size-2 color-secondary'>{name}</span>;
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
