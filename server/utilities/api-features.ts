/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { Document, Model, PopulateOptions, FilterQuery, Query } from 'mongoose';
import { filterObject } from '@utilities/runtime';
import RuntimeError from '@/utilities/runtime-error';

/**
 * Interface for the request query string 
*/
interface RequestQueryString{
    // Search query
    readonly search?: string;
    readonly q?: string;

    readonly page?: string;
    readonly sort?: string;
    readonly limit?: string;
    readonly fields?: string;
    readonly populate?: string | PopulateOptions;
    readonly [key: string]: unknown;
}

/**
 * Internal buffer interface for storing processed query parameters
*/
interface QueryBuffer{
    find: FilterQuery<any>;
    sort: Record<string, 1 | -1> | string;
    select: string;
    skip: number;
    limit: number;
    totalResults: number;
    skippedResults: number;
    page: number;
    totalPages: number;
}

/**
 * Configuration options for APIFeatures
 * @template T - The document type extending Mongoose Document
*/
interface APIFeaturesOptions<T extends Document = Document> {
    readonly requestQueryString: RequestQueryString;
    readonly model: Model<T>;
    readonly fields: readonly string[];
    readonly populate?: string | PopulateOptions | (string | PopulateOptions)[] | null;
    readonly baseFilter?: FilterQuery<T>;
}

/**
 * Result interface for the perform method
 * @template T - The document type extending Mongoose Document
*/
interface QueryResult<T extends Document = Document> {
    readonly records: T[];
    readonly totalResults: number;
    readonly skippedResults: number;
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;
}

/**
 * Configuration constants
*/
const DEFAULT_CONFIG = {
    DEFAULT_LIMIT: 100,
    DEFAULT_PAGE: 1,
    DEFAULT_SORT: '-createdAt',
    UNLIMITED_RESULTS: -1,
    EXCLUDED_QUERY_FIELDS: ['page', 'sort', 'limit', 'fields', 'populate', 'q'] as const
} as const;

/**
 * Class for handling API features such as search, filter, sort, pagination,
 * and field selection with improved type safety and perfomance.
 * @template T - The document type extending Mongoose Document 
*/
class APIFeatures<T extends Document = Document>{
    private readonly model: Model<T>;
    private readonly requestQueryString: RequestQueryString;
    private readonly populate: string | PopulateOptions | (string | PopulateOptions)[] | null;
    private readonly fields: readonly string[];
    private readonly buffer: QueryBuffer;
    private readonly baseFilter: FilterQuery<T>;

    /**
     * Creates an instance of APIFeatures with improved initialization.
     * @param options - Configuration options
    */
    constructor({
        requestQueryString,
        model,
        fields = [],
        baseFilter = {},
        populate = null
    }: APIFeaturesOptions<T>){
        this.model = model;
        this.requestQueryString = Object.freeze({ ...requestQueryString });
        this.fields = Object.freeze([ ...fields ]);
        this.populate = populate;
        this.baseFilter = baseFilter;

        // Initialize buffer with default values
        this.buffer = {
            find: { ...baseFilter },
            sort: DEFAULT_CONFIG.DEFAULT_SORT,
            select: '',
            skip: 0,
            limit: DEFAULT_CONFIG.DEFAULT_LIMIT,
            totalResults: 0,
            skippedResults: 0,
            page: DEFAULT_CONFIG.DEFAULT_PAGE,
            totalPages: 1
        };
    }

    /**
     * Performs the query and returns the result with improved error handling.
     * @returns Promise resolving to query results and pagination data 
    */
    public async perform(): Promise<QueryResult<T>>{
        const { find, sort, select, skip, limit, totalResults, skippedResults, page, totalPages } = this.buffer;
        try{
            let query: Query<T[], T> = this.model
                .find(find)
                .skip(skip)
                .limit(limit)
                .sort(sort);
            
                if(select){
                    query = query.select(select);
                }

                query = this.applyPopulation(query);

                const records = await query.exec();

                return {
                    records,
                    totalResults,
                    skippedResults,
                    page,
                    limit,
                    totalPages
                }
        }catch(error){
            throw new RuntimeError('Core::APIFeatures::QueryExecutionFailed', 500);
        }
    }

    /**
     * Applies population options to the query
     * @param query - The Mongoose query to apply population to
     * @returns The query with population applied
    */
    private applyPopulation(query: Query<T[], T>): Query<T[], T>{
        if(!this.populate){
            return query;
        }

        if(typeof this.populate === 'string'){
            return query.populate(this.populate);
        }

        if(Array.isArray(this.populate)){
            const arr = [...this.populate] as (string | PopulateOptions)[];
            return arr.reduce((q, popOption) => q.populate(popOption as any), query);
        }

        return query.populate(this.populate);
    }

    /**
     * Applies text search with improved error handling and escaping.
     * @returns The current instance for method chaining
    */
    public search(): this{
        const searchTerm = this.requestQueryString.q || this.requestQueryString.search;
        if(!searchTerm || typeof searchTerm !== 'string'){
            return this;
        }

        try{
            const escapedTerm = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if(escapedTerm){
                this.buffer.find = {
                    ...this.buffer.find,
                    $text: { $search: escapedTerm }
                };
                this.buffer.sort = { score: { $meta: 'textScore' } } as any;
            }
        }catch(error){
            console.warn('APIFeatures: Text search failed, continuing without search');
        }

        return this;
    }

    /**
     * Applies filtering with improved type safety and validation.
     * @returns The current instance for method chaining
    */
    public filter(): this{
        const queryObject = { ...this.requestQueryString };
        DEFAULT_CONFIG.EXCLUDED_QUERY_FIELDS.forEach((field) => delete queryObject[field]);
        if(Object.keys(queryObject).length === 0){
            return this;
        }

        try{
            const filteredQuery = filterObject(queryObject, ...this.fields);
            this.buffer.find = { ...this.buffer.find, ...filteredQuery };
        }catch(error){
            console.warn('APIFeatures: Filtering failed, continuing without additional filters');
        }

        return this;
    }

    /**
     * Applies sorting with validation and fallback.
     * @returns The current instance for method chaining
    */
    public sort(): this{
        const sortParam = this.requestQueryString.sort;
        if(!sortParam || typeof sortParam !== 'string'){
            this.buffer.sort = DEFAULT_CONFIG.DEFAULT_SORT;
            return this;
        }

        try{
            // Convert comma-separated string to space-separated for Mongoose
            const sortFields = sortParam
                .split(',')
                .map((field) => field.trim())
                .filter((field) => field.length > 0)
                .join(' ');
            
            this.buffer.sort = sortFields || DEFAULT_CONFIG.DEFAULT_SORT;
        }catch(error){
            this.buffer.sort = DEFAULT_CONFIG.DEFAULT_SORT;
        }

        return this;
    }

    /**
     * Applies field selection with validation.
     * @returns The current instance for method chaining
    */
    public limitFields(): this{
        const fieldsParam = this.requestQueryString.fields;
        if(!fieldsParam || typeof fieldsParam !== 'string'){
            return this;
        }

        try{
            const selectedFields = fieldsParam
                .split(',')
                .map((field) => field.trim())
                .filter((field) => field.length > 0)
                .join(' ');
            if(selectedFields){
                this.buffer.select = selectedFields;
            }
        }catch(error){
            console.warn('APIFeatures: Field selection failed, returning all fields');
        }

        return this;
    }

    /**
     * Applies pagination with comprehensive validation and error handling.
     * @returns Promise resolving to the current instance
     * @throws RuntimeError if the requested page is out of range
    */
    public async paginate(): Promise<this>{
        const limitParam = this.requestQueryString.limit;
        const pageParam = this.requestQueryString.page;

        // Parse and validate limit
        const limit = this.parseLimit(limitParam);
        if(limit === DEFAULT_CONFIG.UNLIMITED_RESULTS){
            // No pagination requested
            this.buffer.limit = 0;
            return this;
        }

        // Parse and validate page
        const page = this.parsePage(pageParam);
        const skip = (page - 1) * limit;
        
        // Update buffer with pagination values
        this.buffer.skip = skip;
        this.buffer.limit = limit;
        this.buffer.page = page;
        this.buffer.skippedResults = skip;

        try{
            // Get total count for pagination calculations
            const totalCount = await this.model.countDocuments(this.buffer.find);
            this.buffer.totalResults = totalCount;
            this.buffer.totalPages = Math.ceil(totalCount / limit) || 1;

            // validate requested page is within range
            if(pageParam && skip >= totalCount && totalCount > 0){
                throw new RuntimeError('Core::PageOutOfRange', 404);
            }
        }catch(error){
            if(error instanceof RuntimeError){
                throw error;
            }
            throw new RuntimeError('Core::PaginationError', 500);
        }

        return this;
    }

    /**
     * Parses and validates the limit parameter.
     * @param limitParam - The limit parameter from query string
     * @returns Validated limit value
    */
    private parseLimit(limitParam: unknown): number{
        if(!limitParam || typeof limitParam !== 'string'){
            return DEFAULT_CONFIG.DEFAULT_LIMIT;
        }

        const parsedLimit = parseInt(limitParam, 10);

        if(parsedLimit === -1){
            return DEFAULT_CONFIG.UNLIMITED_RESULTS;
        }

        if(isNaN(parsedLimit) || parsedLimit < 1){
            return DEFAULT_CONFIG.DEFAULT_LIMIT;
        }

        // Apply reasonable upper limit to prevent abuse
        return Math.min(parsedLimit, 1000);
    }

    /**
     * Parses and validates the page parameter.
     * @param pageParam - The page parameter from query string
     * @returns Validated page value
    */
    private parsePage(pageParam: unknown): number{
        if(!pageParam || typeof pageParam !== 'string'){
            return DEFAULT_CONFIG.DEFAULT_PAGE;
        }

        const parsedPage = parseInt(pageParam, 10);
        return isNaN(parsedPage) || parsedPage < 1 ? DEFAULT_CONFIG.DEFAULT_PAGE : parsedPage;
    }
}

export default APIFeatures;