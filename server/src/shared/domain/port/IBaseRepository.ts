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
    /**
     * Find a single entity by its ID.
     */
    findById(
        id: string,
        options?: Pick<FindOptions<T>, 'populate' | 'select'>
    ): Promise<T | null>;

    /**
     * Find a single entity matching the filter.
     */
    findOne(
        filter: RepositoryFilter<TProps>,
        options?: Pick<FindOptions<TProps>, 'populate' | 'select'>
    ): Promise<T | null>;

    /**
     * Find all entities matching the filter.
     */
    findAll(options?: FindOptions<TProps> & PaginationOptions): Promise<PaginatedResult<T>>;

    /**
     * Export all entities matching the filter without pagination.
     */
    export(options?: Omit<FindOptions<TProps>, 'limit' | 'skip'>): Promise<T[]>;

    /**
     * Create new entity.
     */
    create(data: Partial<TProps>): Promise<T>;

    /**
     * Update an entity by ID.
     */
    updateById(
        id: string,
        data: Partial<TProps>,
        options?: Pick<FindOptions<TProps>, 'populate' | 'select'>
    ): Promise<T | null>;

    /**
     * Update first entity matching the filter.
     */
    updateMany(
        filter: RepositoryFilter<TProps>,
        data: Partial<TProps>
    ): Promise<number>;

    insertMany(data: Partial<TProps> | Array<Partial<TProps>>): Promise<void>;

    /**
     * Delete an entity by ID.
     */
    deleteById(id: string): Promise<boolean>;

    /**
     * Delete all entities matching filter.
     */
    deleteMany(filter: RepositoryFilter<TProps>): Promise<number>;

    /**
     * Count entities matching fiter.
     */
    count(filter?: RepositoryFilter<TProps>): Promise<number>;

    countGroupedBy(
        field: string,
        fieldValues: string[],
        filter?: RepositoryFilter<TProps>
    ): Promise<Map<string, number>>;

    /**
     * Check if any entity matches the filter.
     */
    exists(filter: RepositoryFilter<TProps> | EntityIdFilter): Promise<boolean>;
}
