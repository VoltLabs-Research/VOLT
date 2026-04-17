export interface PaginationInput {
    page: number;
    limit: number;
}

export interface PaginatedResult<T> {
    data: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export const normalizePagination = (page: number, limit: number): PaginationInput => ({
    page: Math.max(1, Math.floor(page)),
    limit: Math.max(1, Math.floor(limit))
});

export const calculatePaginationOffset = (page: number, limit: number): number => {
    const normalized = normalizePagination(page, limit);
    return (normalized.page - 1) * normalized.limit;
};

export const calculateTotalPages = (total: number, limit: number): number => {
    return Math.max(1, Math.ceil(total / Math.max(1, Math.floor(limit))));
};
