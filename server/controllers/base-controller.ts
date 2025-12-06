import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Model, Document, FilterQuery, PopulateOptions } from 'mongoose';
import { catchAsync, filterObject, checkIfSlugOrId } from '@/utilities/runtime/runtime';
import APIFeatures from '@/utilities/api-features';
import RuntimeError from '@/utilities/runtime/runtime-error';

/**
 * Configuration options passed to the BaseController constructor
 */
export interface BaseControllerConfig{
    /** Fields allowed to be filtered/selected */
    fields?: string[];
    /** Default population configuration */
    populate?: PopulateOptions | string | (PopulateOptions | string)[];
    /** Resource name for error messages (e.g, 'Trajectory', 'User') */
    resourceName?: string;
};

/**
 * Abstract Base Controller class.
 */
export default abstract class BaseController<T extends Document>{
    protected readonly model: Model<T>;
    protected readonly allowedFields: string[];
    protected readonly defaultPopulate?: PopulateOptions | string | (PopulateOptions | string)[];
    protected readonly resourceName: string;

    constructor(model: Model<T>, config: BaseControllerConfig = {}){
        this.model = model;
        this.allowedFields = config.fields || [];
        this.defaultPopulate = config.populate;
        this.resourceName = config.resourceName || model.modelName;
    }

    /**
     * Return specific filter for GetOne/Update/Delete (e.g, limit to user ID)
     */
    protected async getFilter(req: Request): Promise<FilterQuery<T>>{
        return {};
    }

    /** Modify data before creation. Return the data to be saved. */
    protected async onBeforeCreate(data: Partial<T>, req: Request): Promise<Partial<T>>{
        return data;
    }

    /** Action after creation (e.g., logging, related updates) */
    protected async onAfterCreate(doc: T, req: Request): Promise<void>{}

    /** Modify data before update. Return the data to be updated. */
    protected async onBeforeUpdate(data: Partial<T>, req: Request, currentDoc: T): Promise<Partial<T>>{
        return data;
    }

    /** Action after update */
    protected async onAfterUpdate(doc: T, req: Request): Promise<void>{}

    /** Action before delete (e.g., cleanup related resources) */
    protected async onBeforeDelete(doc: T, req: Request): Promise<void>{}

    /** Resolve populate options dinamically from requests or defaults */
    protected getPopulate(req: Request): PopulateOptions | string | (PopulateOptions | string)[] | undefined{
        return this.defaultPopulate;
    }

    public createOne = catchAsync(async (req: Request, res: Response) => {
        // Filter allowed fields from body
        let data = this.allowedFields.length > 0 
            ? filterObject(req.body, ...this.allowedFields) as Partial<T>
            : req.body;
        
        data = await this.onBeforeCreate(data, req);
        const doc = await this.model.create(data);
        await this.onAfterCreate(doc, req);

        res.status(200).json({
            status: 'success',
            data: doc
        });
    });

    public getOne = catchAsync(async (req: Request, res: Response) => {
        if(!req.params.id) throw new RuntimeError('MissingIDParameter', 400);
        // Determine filter (ID/Slug + Custom Security Filter)
        const idFilter = checkIfSlugOrId(req.params.id);
        const securityFilter = await this.getFilter(req);
        const finalFilter = { ...idFilter, ...securityFilter };

        // Query
        let query = this.model.findOne(finalFilter);
        const populate = this.getPopulate(req);
        if(populate) query = query.populate(populate as any)

        const doc = await query.exec();
        if(!doc) throw new RuntimeError(`${this.resourceName}DocumentNotFound`, 404);

        res.status(200).json({
            status: 'success',
            data: doc
        });
    });

    public getAll = catchAsync(async (req: Request, res: Response) => {
        const securityFilter = await this.getFilter(req);

        const features = new APIFeatures({
            requestQueryString: req.query,
            model: this.model,
            fields: this.allowedFields,
            populate: this.getPopulate(req),
            baseFilter: securityFilter
        });

        await features.filter().sort().limitFields().search().paginate();
        const result = await features.perform();
        
        res.status(200).json({
            status: 'successs',
            page: {
                current: result.page,
                total: result.totalPages
            },
            results: {
                skipped: result.skippedResults,
                total: result.totalResults,
                paginated: result.limit
            },
            data: result.records
        });
    });

    public updateOne = catchAsync(async (req: Request, res: Response) => {
        if(!req.params.id) throw new RuntimeError('MissingIDParameter', 400);

        const idFilter = checkIfSlugOrId(req.params.id);
        const securityFilter = await this.getFilter(req);
        const docToUpdate = await this.model.findOne({ ...idFilter, ...securityFilter });

        if(!docToUpdate) throw new RuntimeError(`${this.resourceName}DocumentNotFound`, 404);
        
        let data = this.allowedFields.length > 0
            ? filterObject(req.body, ...this.allowedFields)
            : req.body;
        
        data = await this.onBeforeUpdate(data, req, docToUpdate);
        const updatedDoc = await this.model.findOneAndUpdate(
            { _id: docToUpdate._id },
            data,
            { new: true, runValidators: true });
        
        if(updatedDoc) await this.onAfterUpdate(updatedDoc, req);

        res.status(200).json({
            status: 'success',
            data: updatedDoc
        });
    });

    public deleteOne = catchAsync(async (req: Request, res: Response) => {
        if(!req.params.id) throw new RuntimeError('MissingIDParameter', 400);
        
        const idFilter = checkIfSlugOrId(req.params.id);
        const securityFilter = await this.getFilter(req);
        const doc = await this.model.findOne({ ...idFilter, ...securityFilter });

        if(!doc) throw new RuntimeError(`${this.resourceName}DocumentNotFound`, 404);
        
        await this.onBeforeDelete(doc, req);
        await this.model.deleteOne({ _id: doc._id });
        res.status(204).json({
            status: 'success',
            data: null
        });
    });
};