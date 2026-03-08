import type { InfiniteData, QueryKey } from '@tanstack/react-query';
import type { PaginatedResponse, PaginationMeta } from '@/shared/domain/pagination';
import queryClient from './query-client';

interface WithId {
    _id: string;
}

// ---------------------------------------------------------------------------
// Paginated page helpers
// ---------------------------------------------------------------------------

/**
 * Upsert an entity into a flat PaginatedResponse.
 * If found, merges in-place; otherwise prepends (sliced to limit).
 */
export const upsertEntityInList = <T extends WithId>(
    page: PaginatedResponse<T>,
    entity: T
): PaginatedResponse<T> => {
    const exists = page.data.some((e) => e._id === entity._id);
    const data = exists
        ? page.data.map((e) => (e._id === entity._id ? { ...e, ...entity } : e))
        : [entity, ...page.data].slice(0, page.pagination.limit);
    const pagination: PaginationMeta = exists
        ? page.pagination
        : adjustPagination(page.pagination, 1);
    return { ...page, data, pagination };
};

/**
 * Remove an entity from a flat PaginatedResponse by id.
 */
export const removeEntityFromList = <T extends WithId>(
    page: PaginatedResponse<T>,
    id: string
): PaginatedResponse<T> => ({
    ...page,
    data: page.data.filter((e) => e._id !== id),
    pagination: adjustPagination(page.pagination, -1)
});

/**
 * Apply an updater to every flat PaginatedResponse matching a key prefix.
 */
export const patchPaginatedPage = <T extends WithId>(
    keyPrefix: QueryKey,
    updater: (current: PaginatedResponse<T>) => PaginatedResponse<T>
): void => {
    queryClient.setQueriesData<PaginatedResponse<T>>(
        { queryKey: keyPrefix },
        (current) => (current ? updater(current) : current)
    );
};

// ---------------------------------------------------------------------------
// Infinite query helpers
// ---------------------------------------------------------------------------

/**
 * Apply an updater to every page inside all infinite queries matching a key prefix.
 */
export const patchInfinitePages = <T extends WithId>(
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

/**
 * Prepend an entity to the first page of all infinite queries matching a key prefix.
 */
export const prependToFirstInfinitePage = <T extends WithId>(
    keyPrefix: QueryKey,
    entity: T
): void => {
    queryClient.setQueriesData<InfiniteData<PaginatedResponse<T>>>(
        { queryKey: keyPrefix },
        (current) => {
            if (!current || current.pages.length === 0) return current;
            const firstPage = current.pages[0];
            const exists = firstPage.data.some((e) => e._id === entity._id);
            if (exists) return current;
            const pages = [...current.pages];
            pages[0] = {
                ...firstPage,
                data: [entity, ...firstPage.data].slice(0, firstPage.pagination.limit),
                pagination: adjustPagination(firstPage.pagination, 1)
            };
            return { ...current, pages, pageParams: current.pageParams };
        }
    );
};

// ---------------------------------------------------------------------------
// Batch invalidation
// ---------------------------------------------------------------------------

/**
 * Invalidate multiple query key prefixes in parallel.
 */
export const batchInvalidateQueries = (keys: QueryKey[]): Promise<void[]> => {
    return Promise.all(
        keys.map((key) => queryClient.invalidateQueries({ queryKey: key }))
    );
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const adjustPagination = (meta: PaginationMeta, delta: number): PaginationMeta => {
    const total = Math.max(0, meta.total + delta);
    return {
        ...meta,
        total,
        totalPages: Math.ceil(total / meta.limit)
    };
};
