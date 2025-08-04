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

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Document, Model, FilterQuery, PopulateOptions } from 'mongoose';
import { catchAsync, filterObject, checkIfSlugOrId } from '@utilities/runtime';
import APIFeatures from '@/utilities/api-features';
import RuntimeError from '@/utilities/runtime-error';

/**
 * Interface for API response structure 
*/
interface ApiResponse<T = any>{
    status: 'success' | 'error';
    data?: T;
}

/**
 * Interface for paginated API response
*/
interface PaginatedApiResponse<T = any> extends ApiResponse<T[]>{
    page: {
        current: number;
        total: number;
    };
    results: {
        skipped: number;
        total: number;
        paginated: number;
    };
}

interface HandlerOptions<T extends Document = Document>{
    model: any,
    fields: string[],
    beforeCreate?: (data: any, req: Request) => any | Promise<any>;
    afterCreate?: (doc: T, req: Request) => void | Promise<void>;
    beforeUpdate?: (data: any, req: Request, doc: T) => any | Promise<any>;
    afterUpdate?: (doc: T, req: Request) => void | Promise<void>;
    beforeDelete?: (doc: T, req: Request) => void | Promise<void>;
    afterDelete?: (doc: T, req: Request) => void | Promise<void>;
    customFilter?: (req: Request) => FilterQuery<T> | Promise<FilterQuery<T>>;
    customPopulate?: (req: Request) => PopulateOptions | string | null;
    allowedFields?: string[];
    requiredFields?: string[];
    errorMessages?: {
        notFound?: string;
        validation?: string;
        unauthorized?: string;
    };
}

/**
 * A class that provides reusable handlers for common CRUD operations.
 * @template T - The document type extending Mongoose Document 
*/
class HandlerFactory<T extends Document = Document>{
    private readonly model: Model<T>;
    private readonly fields: readonly string[];
    private readonly options: HandlerOptions<T>;

    /**
     * Creates an instance of HandlerFactory.
     * @param options - The configuration options
    */
    constructor({ model, fields = [], ...options }: HandlerOptions<T>){
        this.model = model;
        // Inmutable copy
        this.fields = Object.freeze([ ...fields ]);
        this.options = options;
    }

    /**
     * Handler for deleting a single record.
     * @returns The express request handler
    */
    public deleteOne(): RequestHandler{
        return catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            const filter = checkIfSlugOrId(req.params.id);

            const databaseRecord = await this.model.findOneAndDelete(filter);
            if(!databaseRecord){
                return next(new RuntimeError('Core::DeleteOne::RecordNotFound', 404));
            }

            if(this.options.beforeDelete){
                await this.options.beforeDelete(databaseRecord, req);
            }

            await this.model.findOneAndDelete(filter);

            if(this.options.afterDelete){
                await this.options.afterDelete(databaseRecord, req);
            }

            const response: ApiResponse<T> = {
                status: 'success',
                data: databaseRecord
            };

            res.status(204).json(response);
        });
    }

    /**
     * Handler for updating a single record.
     * @returns The express request handler
    */
    public updateOne(): RequestHandler{
        return catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            const filter = checkIfSlugOrId(req.params.id);

            const existingDoc = await this.model.findOne(filter);
            if(!existingDoc){
                const errorMessage = this.options.errorMessages?.notFound || 'Core::UpdateOne::RecordNotFound';
                return next(new RuntimeError(errorMessage, 404));
            }

            let queryFilter = filterObject(req.body, ...this.fields);
            if(this.options.beforeUpdate){
                queryFilter = await this.options.beforeUpdate(queryFilter, req, existingDoc);
            }

            const databaseRecord = await this.model.findOneAndUpdate(filter, queryFilter, {
                new: true,
                runValidators: true,
                lean: false
            });

            if(this.options.afterUpdate && databaseRecord){
                await this.options.afterUpdate(databaseRecord, req);
            }

            const response: ApiResponse<T> = {
                status: 'success',
                data: databaseRecord!
            };

            res.status(200).json(response);
        });
    }

    /**
     * Handler for creating a new record.
     * @returns The Express request handler
    */
    public createOne(): RequestHandler{
        return catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            // Validate required fields
            if(this.options.requiredFields){
                const missing = this.options.requiredFields.filter(
                    (field) => !req.body[field] && req.body[field] !== 0 && req.body[field] !== false);
                if(missing.length > 0){
                    const errorMessage = this.options.errorMessages?.validation || `Missing required fields: ${missing.join(', ')}`;
                    return next(new RuntimeError(errorMessage, 400));
                }
            }

            let queryFilter = filterObject(req.body, ...this.fields);

            if(this.options.beforeCreate){
                queryFilter = await this.options.beforeCreate(queryFilter, req);
            }
            
            const databaseRecord = await this.model.create(queryFilter);

            if(this.options.afterCreate){
                await this.options.afterCreate(databaseRecord, req);
            }

            const response: ApiResponse<T> = {
                status: 'success',
                data: databaseRecord
            };

            res.status(201).json(response);
        });
    }

    /**
     * Retrieves and parses the populate option from the request query.
     * @param requestQuery - The request query object
     * @returns The populate option as a string, or null if not provided
    */
    private getPopulateFromRequest(requestQuery: Request['query']): string | null{
        const populate = requestQuery?.populate;
        if(!populate || typeof populate !== 'string'){
            return null;
        }

        try{
            // Handle JSON format: { "foo": 1, "bar": 1 }
            if(populate.startsWith('{')){
                const parsed = JSON.parse(populate);
                if(Array.isArray(parsed)){
                    return parsed.join(' ');
                }
                // If it's an object, get the keys
                return Object.keys(parsed).join(' ');
            }

            // Handle comma-separated format: "foo,bar"
            return populate.split(',').map((field) => field.trim()).join(' ');
        }catch(error){
            // If JSON parsing fails, treat as comma-separated string
            return populate.split(',').map((field) => field.trim()).join(' ');
        }
    }
    
    /**
     * Handler for retrieving all records with filtering, sorting, and pagination.
     * @returns The Express request handler 
    */
    public getAll(): RequestHandler{
        return catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            let baseFilter = {};

            // Apply custom filter if provided
            if(this.options.customFilter){
                try{
                    baseFilter = await this.options.customFilter(req);
                }catch(err){
                    const errorMessage = this.options.errorMessages?.unauthorized || 'Access denied';
                    return next(new RuntimeError(errorMessage, 403));
                }
            }

            const populate = this.options.customPopulate
                ? await this.options.customPopulate(req)
                : this.getPopulateFromRequest(req.query);
                
            const operations = new APIFeatures({
                requestQueryString: req.query,
                model: this.model,
                // Create mutable copy for APIFeatures
                fields: [...this.fields],
                populate
            })
                .filter()
                .sort()
                .limitFields()
                .search();
            
            await operations.paginate();
            const result = await operations.perform();

            const response: PaginatedApiResponse<T> = {
                status: 'success',
                page: {
                    current: result.page,
                    total: result.totalPages
                },
                results: {
                    skipped: result.skippedResults,
                    total: result.totalResults,
                    paginated: result.limit
                },
                data: result.records as T[]
            };

            res.status(200).json(response);
        });
    }

    /**
     * Handler for retrieving a single record by ID or slug.
     * @returns The Express request handler
    */
    public getOne(): RequestHandler{
        return catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            const populate = this.options.customPopulate
                ? await this.options.customPopulate(req)
                : this.getPopulateFromRequest(req.query);

            const filter = checkIfSlugOrId(req.params.id);

            let databaseRecord = await this.model.findOne(filter);
            if(!databaseRecord){
                return next(new RuntimeError('Core::GetOne::RecordNotFound', 404));
            }

            if(populate){
                databaseRecord = await databaseRecord.populate(populate);
            }

            const response: ApiResponse<T> = {
                status: 'success',
                data: databaseRecord
            };

            res.status(200).json(response);
        });
    }

    /**
     * Get user-specific records
     * @param userField - The field that contains the user reference
     * @returns The express request handler
    */
    public getUserRecords(userField: string = 'user'): RequestHandler{
        return catchAsync(async (req: Request, res: Response): Promise<void> => {
            const userId = (req as any).user.id;
            let filter = { [userField]: userId };

            if(this.options.customFilter){
                const customFilter = await this.options.customFilter(req);
                filter = { ...filter, ...customFilter };
            }

            const populate = this.options.customPopulate
                ? await this.options.customPopulate(req)
                : this.getPopulateFromRequest(req.query);

            const records = await this.model.find(filter)
                .sort(populate || '')
                .sort({ createdAt: -1 });
            
            res.status(200).json({
                status: 'success',
                data: records
            });
        });
    }

    /**
     * Bulk operation handler
     * @param operation - The type of bulk operation
     * @returns The express request handler
    */
    public bulkOperation(operation: 'create' | 'update' | 'delete'): RequestHandler{
        return catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            const { items } = req.body;
            if(!Array.isArray(items) || items.length === 0){
                return next(new RuntimeError('Items array is required', 400));
            }

            let result;
            switch(operation){
                case 'create':
                    const createData = items.map((item) => {
                        let filtered = filterObject(item, ...this.fields);
                        return filtered;
                    });
                    result = await this.model.insertMany(createData);
                    break;

                case 'update':
                    result = await Promise.all(items.map(async (item) => {
                        if(!item.id){
                            throw new Error('ID is required for bulk update');
                        }
                        const filtered = filterObject(item, ...this.fields);
                        return await this.model.findByIdAndUpdate(
                            item.id,
                            filtered,
                            { new: true, runValidators: true }
                        )
                    }));
                    break;

                case 'delete':
                    const ids = items.map((item) => item.id || item._id).filter(Boolean);
                    if(ids.length === 0){
                        throw new Error('No valid IDs provided for bulk delete');
                    }
                    result = await this.model.deleteMany({ _id: { $in: ids } });
                    break;
                
                default:
                    return next(new RuntimeError('Invalid bulk operation', 400));
            }

            res.status(200).json({
                status: 'success',
                data: result
            });
        });
    }
}

export default HandlerFactory;