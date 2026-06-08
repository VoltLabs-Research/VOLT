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
}

export enum ExportType {
    Json = 'json',
    Csv = 'csv'
}

export interface EntityIdFilter {
    _id: string;
}

export interface IBaseRepository<T, TProps> {
    findById(
        id: string,
        options?: Pick<FindOptions<T>, 'populate' | 'select'>
    ): Promise<T | null>;

    findOne(
        filter: RepositoryFilter<TProps>,
        options?: Pick<FindOptions<TProps>, 'populate' | 'select'>
    ): Promise<T | null>;

    findAll(options?: FindOptions<TProps> & PaginationOptions): Promise<PaginatedResult<T>>;

    export(options?: Omit<FindOptions<TProps>, 'limit' | 'skip'>): Promise<T[]>;

    create(data: Partial<TProps>): Promise<T>;

    updateById(
        id: string,
        data: Partial<TProps>,
        options?: Pick<FindOptions<TProps>, 'populate' | 'select'>
    ): Promise<T | null>;

    updateMany(
        filter: RepositoryFilter<TProps>,
        data: Partial<TProps>
    ): Promise<number>;

    insertMany(data: Partial<TProps> | Array<Partial<TProps>>): Promise<void>;

    deleteById(id: string): Promise<boolean>;

    deleteMany(filter: RepositoryFilter<TProps>): Promise<number>;

    count(filter?: RepositoryFilter<TProps>): Promise<number>;

    countGroupedBy(
        field: string,
        fieldValues: string[],
        filter?: RepositoryFilter<TProps>
    ): Promise<Map<string, number>>;

    exists(filter: RepositoryFilter<TProps> | EntityIdFilter): Promise<boolean>;
}
