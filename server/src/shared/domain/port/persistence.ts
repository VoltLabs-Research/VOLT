export interface PopulatePath {
    path: string;
    select?: string[];
    populate?: PopulatePath | PopulatePath[];
}

export interface FindOptions<T> {
    filter?: RepositoryFilter<T>;
    populate?: string | string[] | PopulatePath | PopulatePath[];
    select?: string[];
    sort?: Record<string, 1 | -1>;
    limit?: number;
    skip?: number;
}

export type RepositoryFilter<T> = Partial<T> | Record<string, unknown>;

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
