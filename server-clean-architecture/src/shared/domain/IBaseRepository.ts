import { PopulateOptions } from 'mongoose';

export interface FindOptions<T>{
    filter?: Partial<T>;
    populate?: PopulateOptions | string | (PopulateOptions | string)[];
    select?: string[];
    sort?: Record<string, 1 | -1>;
    limit?: number;
    skip?: number;
};

export interface PaginatedResult<T>{
    data: T[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
};

export interface PaginationOptions{
    page: number;
    limit: number;
};

export interface IBaseRepository<T>{
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
        filter: Partial<T>,
        options?: Pick<FindOptions<T>, 'populate' | 'select'>
    ): Promise<T | null>;

    /**
     * Find all entities matching the filter.
     */
    findAll(options?: FindOptions<T> & PaginationOptions): Promise<T[]>;

    /**
     * Create new entity.
     */
    create(entity: Partial<T>): Promise<T>;

    /**
     * Update an entity by ID.
     */
    updateById(
        id: string,
        data: Partial<T>
    ): Promise<T | null>;

    /**
     * Update first entity matching the filter.
     */
    updateMany(
        filter: Partial<T>,
        data: Partial<T>
    ): Promise<number>;

    /**
     * Delete an entity by ID.
     */
    deleteById(id: string): Promise<boolean>;

    /**
     * Delete all entities matching filter.
     */
    deleteMany(filter: Partial<T>): Promise<number>;

    /**
     * Count entities matching fiter.
     */
    count(filter?: Partial<T>): Promise<number>;

    /**
     * Check if any entity matches the filter.
     */
    exists(filter: Partial<T>): Promise<boolean>;
};