import type { PaginatedResult } from '@shared/domain/port/persistence';

export interface PageRequest{
    page: number;
    limit: number;
}

export interface PageRequestOptions{
    defaultLimit: number;
    maxLimit?: number;
}

export const readPageRequest = (page: number | undefined, limit: number | undefined, { defaultLimit, maxLimit = 500 }: PageRequestOptions): PageRequest => {
    const requestedPage = Number(page);
    const requestedLimit = Number(limit);

    return {
        page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
        limit: Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, maxLimit) : defaultLimit
    };
};

export const skipFor = ({ page, limit }: PageRequest): number => (page - 1) * limit;

export const paginate = <T>([data, total]: [T[], number], { page, limit }: PageRequest, meta?: Record<string, unknown>): PaginatedResult<T> => ({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    ...(meta === undefined ? {} : { _meta: meta })
});
