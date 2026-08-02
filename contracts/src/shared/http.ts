export interface ApiResponse<T>{
    status: string;
    data: T;
}

export interface PaginationMeta{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}
