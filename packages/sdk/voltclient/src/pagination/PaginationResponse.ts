export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
};

export interface PaginatedResponse<T> {
    status: 'success';
    data: T[];
    pagination: PaginationMeta;
    _meta?: Record<string, unknown>;
};
