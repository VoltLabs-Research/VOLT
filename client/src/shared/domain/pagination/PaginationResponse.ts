/**
 * Pagination metadata structure.
 */
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
};

/**
 * Paginated response structure from the backend.
 * Matches the structure returned by BaseResponse.paginated() in server.
 */
export interface PaginatedResponse<T> {
    status: 'success';
    data: T[];
    pagination: PaginationMeta;
    _meta?: Record<string, unknown>;
};
