export interface PopulatePath {
    path: string;
    select?: string[];
    populate?: PopulatePath | PopulatePath[];
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    _meta?: Record<string, unknown>;
}

export interface PaginationOptions {
    page?: number;
    limit?: number;
    withTotal?: boolean;
}

export enum ExportType {
    Json = 'json',
    Csv = 'csv'
}

export interface EntityIdFilter {
    _id: string;
}
