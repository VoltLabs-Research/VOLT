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

/**
 * Options for individual handler methods
*/
interface MethodOptions<T extends Document = Document> {
    beforeCreate?: (data: any, req: Request) => any | Promise<any>;
    afterCreate?: (doc: T, req: Request) => void | Promise<void>;
    beforeUpdate?: (data: any, req: Request, doc: T) => any | Promise<any>;
    afterUpdate?: (doc: T, req: Request) => void | Promise<void>;
    beforeDelete?: (doc: T, req: Request) => void | Promise<void>;
    afterDelete?: (doc: T, req: Request) => void | Promise<void>;
    customFilter?: (req: Request) => FilterQuery<T> | Promise<FilterQuery<T>>;
    customPopulate?: (req: Request) => PopulateOptions | string | null;
    requiredFields?: string[];
    allowedFields?: string[];
    errorMessages?: {
        notFound?: string;
        validation?: string;
        unauthorized?: string;
    };
    populateConfig?: string;
    errorConfig?: string;
}

/**
 * Configuration for HandlerFactory
*/
interface HandlerFactoryConfig<T extends Document = Document> {
    model: Model<T>;
    fields: string[];
    populate?: Record<string, PopulateOptions | string>;
    errorMessages?: Record<string, {
        notFound?: string;
        validation?: string;
        unauthorized?: string;
    }>;
    defaultPopulate?: string;
    defaultErrorConfig?: string;
}

class HandlerFactory<T extends Document = Document>{
    private readonly model: Model<T>;
    private readonly defaultFields: readonly string[];
    private readonly populateConfigs: Record<string, PopulateOptions | string>;
    private readonly errorConfigs: Record<string, {
        notFound?: string;
        validation?: string;
        unauthorized?: string;
    }>;
    private readonly defaultPopulate?: string;
    private readonly defaultErrorConfig?: string;

    constructor({ 
        model, 
        fields = [], 
        populate = {}, 
        errorMessages = {},
        defaultPopulate,
        defaultErrorConfig 
    }: HandlerFactoryConfig<T>){
        this.model = model;
        this.defaultFields = Object.freeze([...fields]);
        this.populateConfigs = populate;
        this.errorConfigs = errorMessages;
        this.defaultPopulate = defaultPopulate;
        this.defaultErrorConfig = defaultErrorConfig;
    }

    /**
     * Resolves populate configuration
    */
    private resolvePopulate(options: MethodOptions<T>, req: Request): PopulateOptions | string | null {
        // Priority: customPopulate > populateConfig > defaultPopulate > query
        if(options.customPopulate){
            return options.customPopulate(req);
        }
        
        if(options.populateConfig && this.populateConfigs[options.populateConfig]){
            return this.populateConfigs[options.populateConfig];
        }
        
        if(this.defaultPopulate && this.populateConfigs[this.defaultPopulate]){
            return this.populateConfigs[this.defaultPopulate];
        }
        
        return this.getPopulateFromRequest(req.query);
    }

    /**
     * Resolves error messages configuration
    */
    private resolveErrorMessages(options: MethodOptions<T>): {
        notFound?: string;
        validation?: string;
        unauthorized?: string;
    }{
        // Priority: options.errorMessages > errorConfig > defaultErrorConfig > defaults
        let resolved = {};

        // Start with default error config if exists
        if(this.defaultErrorConfig && this.errorConfigs[this.defaultErrorConfig]){
            resolved = { ...this.errorConfigs[this.defaultErrorConfig] };
        }

        // Override with specific error config if provided
        if(options.errorConfig && this.errorConfigs[options.errorConfig]){
            resolved = { ...resolved, ...this.errorConfigs[options.errorConfig] };
        }

        // Override with method-specific error messages
        if(options.errorMessages){
            resolved = { ...resolved, ...options.errorMessages };
        }

        return resolved;
    }

    /**
     * Handler for deleting a single record.
    */
    public deleteOne(options: MethodOptions<T> = {}): RequestHandler{
        return catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            if(options.customFilter){
                try{
                    await options.customFilter(req);
                }catch(err){
                    const errorMessages = this.resolveErrorMessages(options);
                    const errorMessage = errorMessages.unauthorized || 'Access denied';
                    return next(new RuntimeError(errorMessage, 403));
                }
            }
            if(!req.params.id){
                return next(new RuntimeError('ID parameter is required', 400));
            }

            const errorMessages = this.resolveErrorMessages(options);
            const filter = checkIfSlugOrId(req.params.id);
            const databaseRecord = await this.model.findOne(filter);

            if(!databaseRecord){
                const errorMessage = errorMessages.notFound || 'Record not found';
                return next(new RuntimeError(errorMessage, 404));
            }

            // Execute beforeDelete hook
            if(options.beforeDelete){
                await options.beforeDelete(databaseRecord, req);
            }

            // Actually delete the record
            await this.model.findOneAndDelete(filter);

            // Execute afterDelete hook
            if(options.afterDelete){
                await options.afterDelete(databaseRecord, req);
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
    */
    public updateOne(options: MethodOptions<T> = {}): RequestHandler{
        return catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            if(options.customFilter){
                try{
                    await options.customFilter(req);
                }catch(err){
                    const errorMessages = this.resolveErrorMessages(options);
                    const errorMessage = errorMessages.unauthorized || 'Access denied';
                    return next(new RuntimeError(errorMessage, 403));
                }
            }

            if(!req.params.id){
                return next(new RuntimeError('ID parameter is required', 400));
            }

            const errorMessages = this.resolveErrorMessages(options);
            const filter = checkIfSlugOrId(req.params.id);
            const existingDoc = await this.model.findOne(filter);

            if(!existingDoc){
                const errorMessage = errorMessages.notFound || 'Record not found';
                return next(new RuntimeError(errorMessage, 404));
            }

            // Use method-specific fields or fall back to default
            const fieldsToUse = options.allowedFields || this.defaultFields;
            let queryFilter = filterObject(req.body, ...fieldsToUse);

            // Execute beforeUpdate hook
            if(options.beforeUpdate){
                queryFilter = await options.beforeUpdate(queryFilter, req, existingDoc);
            }

            const databaseRecord = await this.model.findOneAndUpdate(filter, queryFilter, {
                new: true,
                runValidators: true,
                lean: false
            });

            // Execute afterUpdate hook
            if(options.afterUpdate && databaseRecord){
                await options.afterUpdate(databaseRecord, req);
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
    */
    public createOne(options: MethodOptions<T> = {}): RequestHandler{
        return catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            const errorMessages = this.resolveErrorMessages(options);

            // Validate required fields
            if(options.requiredFields){
                const missing = options.requiredFields.filter(
                    (field) => !req.body[field] && req.body[field] !== 0 && req.body[field] !== false);
                if(missing.length > 0){
                    const errorMessage = errorMessages.validation || `Missing required fields: ${missing.join(', ')}`;
                    return next(new RuntimeError(errorMessage, 400));
                }
            }

            // Use method-specific fields or fall back to default
            const fieldsToUse = options.allowedFields || this.defaultFields;
            let queryFilter = filterObject(req.body, ...fieldsToUse);

            // Execute beforeCreate hook
            if(options.beforeCreate){
                queryFilter = await options.beforeCreate(queryFilter, req);
            }
            
            const databaseRecord = await this.model.create(queryFilter);

            // Execute afterCreate hook
            if(options.afterCreate){
                await options.afterCreate(databaseRecord, req);
            }

            const response: ApiResponse<T> = {
                status: 'success',
                data: databaseRecord
            };

            res.status(201).json(response);
        });
    }

    /**
     * Handler for retrieving all records with filtering, sorting, and pagination.
    */
    public getAll(options: MethodOptions<T> = {}): RequestHandler{
        return catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            const errorMessages = this.resolveErrorMessages(options);
            let baseFilter = {};

            // Apply custom filter if provided
            if(options.customFilter){
                try{
                    baseFilter = await options.customFilter(req);
                }catch(err){
                    const errorMessage = errorMessages.unauthorized || 'Access denied';
                    return next(new RuntimeError(errorMessage, 403));
                }
            }

            // Resolve populate configuration
            const populate = await this.resolvePopulate(options, req);

            // Use method-specific fields or fall back to default
            const fieldsToUse = options.allowedFields || this.defaultFields;

            const operations = new APIFeatures({
                requestQueryString: req.query,
                model: this.model,
                fields: [...fieldsToUse],
                populate,
                baseFilter
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
     */
    public getOne(options: MethodOptions<T> = {}): RequestHandler{
        return catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            if(options.customFilter){
                try{
                    await options.customFilter(req);
                }catch(err){
                    const errorMessages = this.resolveErrorMessages(options);
                    const errorMessage = errorMessages.unauthorized || 'Access denied';
                    return next(new RuntimeError(errorMessage, 403));
                }
            }

            if(!req.params.id){
                return next(new RuntimeError('ID parameter is required', 400));
            }

            const errorMessages = this.resolveErrorMessages(options);
            
            // Resolve populate configuration
            const populate = await this.resolvePopulate(options, req);

            const filter = checkIfSlugOrId(req.params.id);
            let databaseRecord = await this.model.findOne(filter);

            if(!databaseRecord){
                const errorMessage = errorMessages.notFound || 'Record not found';
                return next(new RuntimeError(errorMessage, 404));
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
     * Retrieves and parses the populate option from the request query.
    */
    private getPopulateFromRequest(requestQuery: Request['query']): string | null{
        const populate = requestQuery?.populate;
        if(!populate || typeof populate !== 'string'){
            return null;
        }

        try{
            if(populate.startsWith('{')){
                const parsed = JSON.parse(populate);
                if(Array.isArray(parsed)){
                    return parsed.join(' ');
                }
                return Object.keys(parsed).join(' ');
            }

            return populate.split(',').map((field) => field.trim()).join(' ');
        }catch(error){
            return populate.split(',').map((field) => field.trim()).join(' ');
        }
    }
}

export default HandlerFactory;