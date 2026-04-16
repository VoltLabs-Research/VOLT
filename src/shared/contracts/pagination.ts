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

const normalizePositiveInteger = (value: number): number => {
    if (!Number.isFinite(value) || value < 1) {
        return 1;
    }

    return Math.floor(value);
};

export const normalizePagination = (page: number, limit: number): PaginationInput => ({
    page: normalizePositiveInteger(page),
    limit: normalizePositiveInteger(limit)
});

export const calculatePaginationOffset = (page: number, limit: number): number => {
    const normalized = normalizePagination(page, limit);
    return (normalized.page - 1) * normalized.limit;
};

export const calculateTotalPages = (total: number, limit: number): number => {
    return Math.max(1, Math.ceil(total / normalizePositiveInteger(limit)));
};
