import queryClient from './query-client';
import type { PaginatedResponse, PaginationMeta } from '@/shared/pagination/PaginationResponse';
import type { Identifiable } from '@/shared/contracts/entity';
import type { InfiniteData, Query, QueryKey } from '@tanstack/react-query';

export type QueryDataSnapshot = Array<[QueryKey, unknown]>;

export const upsertEntityInList = <T extends Identifiable>(
    page: PaginatedResponse<T>,
    entity: T
): PaginatedResponse<T> => {
    const exists = page.data.some((e) => e._id === entity._id);
    const data = exists
        ? page.data.map((e) => (e._id === entity._id ? {
            ...e,
            ...entity
        } : e))
        : [entity, ...page.data].slice(0, page.pagination.limit);
    const pagination: PaginationMeta = exists
        ? page.pagination
        : adjustPagination(page.pagination, 1);
    return {
        ...page,
        data,
        pagination
    };
};

export const removeEntityFromList = <T extends Identifiable>(
    page: PaginatedResponse<T>,
    id: string
): PaginatedResponse<T> => {
    const data = page.data.filter((e) => e._id !== id);
    const removedCount = page.data.length - data.length;

    if (removedCount === 0) {
        return page;
    }

    return {
        ...page,
        data,
        pagination: adjustPagination(page.pagination, -removedCount)
    };
};

export const patchPaginatedPage = <T extends Identifiable>(
    keyPrefix: QueryKey,
    updater: (current: PaginatedResponse<T>) => PaginatedResponse<T>
): void => {
    queryClient.setQueriesData<PaginatedResponse<T>>(
        { queryKey: keyPrefix },
        (current) => {
            if (!current || !Array.isArray(current.data)) return current;
            return updater(current);
        }
    );
};

export const patchInfinitePages = <T extends Identifiable>(
    keyPrefix: QueryKey,
    pageUpdater: (page: PaginatedResponse<T>) => PaginatedResponse<T>
): void => {
    queryClient.setQueriesData<InfiniteData<PaginatedResponse<T>>>(
        { queryKey: keyPrefix },
        (current) => {
            if (!current) return current;
            return {
                ...current,
                pages: current.pages.map(pageUpdater),
                pageParams: current.pageParams
            };
        }
    );
};

export const batchInvalidateQueries = (keys: QueryKey[]): Promise<void[]> => {
    return Promise.all(
        keys.map((key) => queryClient.invalidateQueries({ queryKey: key }))
    );
};

export const snapshotQueries = (predicate: (query: Query) => boolean): QueryDataSnapshot => {
    return queryClient.getQueriesData<unknown>({ predicate });
};

export const restoreQueryDataSnapshot = (snapshot: QueryDataSnapshot): void => {
    snapshot.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
    });
};

const adjustPagination = (meta: PaginationMeta, delta: number): PaginationMeta => {
    const total = Math.max(0, meta.total + delta);
    return {
        ...meta,
        total,
        totalPages: Math.ceil(total / meta.limit)
    };
};
