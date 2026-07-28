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

export interface PaginatedApiResponse<T>{
    status: string;
    data: T[];
    pagination: PaginationMeta;
}

export interface ApiErrorResponse{
    status: string;
    code?: string;
    message?: string;
}
