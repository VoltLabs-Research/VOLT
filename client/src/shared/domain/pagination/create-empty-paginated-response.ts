import type { PaginatedResponse } from './PaginationResponse';

interface EmptyPaginationParams {
    page?: number | string;
    limit?: number | string;
}

export const createEmptyPaginatedResponse = <T>(
    params: EmptyPaginationParams
): PaginatedResponse<T> => ({
    status: 'success',
    data: [],
    pagination: {
        page: Math.max(1, Number(params.page) || 1),
        limit: Math.max(1, Number(params.limit) || 20),
        total: 0,
        totalPages: 1,
        hasMore: false
    }
});
