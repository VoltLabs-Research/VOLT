import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Document, Model } from 'mongoose';
import { catchAsync, filterObject, checkIfSlugOrId } from '@utilities/runtime';
import APIFeatures from '@utilities/apiFeatures';
import RuntimeError from '@utilities/runtimeError';

/**
 * Interface for the options passed to the HandlerFactory class.
 * @template T - The document type extending Mongoose Document 
*/
interface HandlerFactoryOptions<T extends Document = Document>{
    model: Model<T>;
    fields?: readonly string[];
}

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

/**
 * A class that provides reusable handlers for common CRUD operations.
 * @template T - The document type extending Mongoose Document 
*/
class HandlerFactory<T extends Document = Document>{
    private readonly model: Model<T>;
    private readonly fields: readonly string[];

    /**
     * Creates an instance of HandlerFactory.
     * @param options - The configuration options
    */
    constructor({ model, fields = [] }: HandlerFactoryOptions<T>){
        this.model = model;
        // Inmutable copy
        this.fields = Object.freeze([ ...fields ]);
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
            const queryFilter = filterObject(req.body, ...this.fields);
            const filter = checkIfSlugOrId(req.params.id);
            
            const databaseRecord = await this.model.findOneAndUpdate(filter, queryFilter, {
                new: true,
                runValidators: true,
                lean: false
            });

            if(!databaseRecord){
                return next(new RuntimeError('Core::UpdateOne::RecordNotFound', 404));
            }

            const response: ApiResponse<T> = {
                status: 'success',
                data: databaseRecord
            };

            res.status(200).json(response);
        });
    }

    /**
     * Handler for creating a new record.
     * @returns The Express request handler
    */
    public createOne(): RequestHandler{
        return catchAsync(async (req: Request, res: Response): Promise<void> => {
            const queryFilter = filterObject(req.body, ...this.fields);
            const databaseRecord = await this.model.create(queryFilter);

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
        return catchAsync(async (req: Request, res: Response): Promise<void> => {
            const populate = this.getPopulateFromRequest(req.query);
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
            const populate = this.getPopulateFromRequest(req.query);
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
}

export default HandlerFactory;