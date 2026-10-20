export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    _meta?: Record<string, unknown>;
}

export enum ExportType {
    Json = 'json',
    Csv = 'csv'
}
