import { Request, Response } from 'express';
import { Model, Document, FilterQuery, PopulateOptions } from 'mongoose';
import { catchAsync, filterObject, checkIfSlugOrId } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import { IAccessControlSubject } from '@/services/access-control/interfaces';
import { Resource, Action, getPermission } from '@/constants/permissions';
import APIFeatures from '@/utilities/api-features';
import RuntimeError from '@/utilities/runtime/runtime-error';
import accessControlService from '@/services/access-control/access-control-service';

export interface BaseControllerConfig {
    fields?: string[];
    populate?: PopulateOptions | string | (PopulateOptions | string)[];
    resourceName?: string;
    resource?: Resource;
}

export default abstract class BaseController<T extends Document> {
    protected readonly model: Model<T>;
    protected readonly allowedFields: string[];
    protected readonly defaultPopulate?: PopulateOptions | string | (PopulateOptions | string)[];
    protected readonly resourceName: string;
    protected readonly resource?: Resource;

    constructor(model: Model<T>, config: BaseControllerConfig = {}) {
        this.model = model;
        this.allowedFields = config.fields || [];
        this.defaultPopulate = config.populate;
        this.resourceName = config.resourceName || model.modelName;
        this.resource = config.resource;
    }

    protected async authorize(
        req: Request,
        teamId: string,
        action: Action,
        resource?: Resource
    ): Promise<void> {
        const user = (req as any).user;

        const subject: IAccessControlSubject = {
            id: user.id || user._id?.toString(),
            type: 'user'
        };

        const targetResource = resource || this.resource || (this.resourceName.toLowerCase() as Resource);
        const permission = getPermission(targetResource, action);

        await accessControlService.enforce(subject, teamId, permission);
    }

    protected async getTeamId(req: Request, doc?: T): Promise<string> {
        return req.params.teamId;
    }

    protected async getFilter(req: Request): Promise<FilterQuery<T>> {
        return {};
    }

    protected async onBeforeCreate(data: Partial<T>, req: Request): Promise<Partial<T>> {
        return data;
    }

    protected async onAfterCreate(doc: T, req: Request): Promise<void> { }

    protected async onBeforeUpdate(data: Partial<T>, req: Request, currentDoc: T): Promise<Partial<T>> {
        return data;
    }

    protected async onAfterUpdate(doc: T, req: Request): Promise<void> { }

    protected async onBeforeDelete(doc: T, req: Request): Promise<void> { }

    protected async create(data: Partial<T>, req: Request): Promise<T>{
        return await this.model.create(data);
    }

    protected getPopulate(req: Request): PopulateOptions | string | (PopulateOptions | string)[] | undefined {
        return this.defaultPopulate;
    }

    public createOne = catchAsync(async (req: Request, res: Response) => {
        let data = this.allowedFields.length > 0
            ? filterObject(req.body, ...this.allowedFields) as Partial<T>
            : req.body;

        data = await this.onBeforeCreate(data, req);

        const teamId = await this.getTeamId(req);
        if (teamId) {
            await this.authorize(req, teamId, Action.CREATE);
        }

        const doc = await this.create(data, req);
        await this.onAfterCreate(doc, req);

        res.status(201).json({
            status: 'success',
            data: doc
        });
    });

    public getOne = catchAsync(async (req: Request, res: Response) => {
        if (!req.params.id) throw new RuntimeError(ErrorCodes.VALIDATION_ID_REQUIRED, 400);

        const idFilter = checkIfSlugOrId(req.params.id);
        const securityFilter = await this.getFilter(req);
        const finalFilter = { ...idFilter, ...securityFilter };

        let query = this.model.findOne(finalFilter);
        const populate = this.getPopulate(req);
        if (populate) query = query.populate(populate as any);

        const doc = await query.exec();
        if (!doc) throw new RuntimeError(ErrorCodes.RESOURCE_NOT_FOUND, 404);

        const teamId = await this.getTeamId(req, doc);
        if (teamId) {
            await this.authorize(req, teamId, Action.READ);
        }

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
            data: result.records
        });
    });

    public updateOne = catchAsync(async (req: Request, res: Response) => {
        if (!req.params.id) throw new RuntimeError(ErrorCodes.VALIDATION_ID_REQUIRED, 400);

        const idFilter = checkIfSlugOrId(req.params.id);
        const securityFilter = await this.getFilter(req);
        const docToUpdate = await this.model.findOne({ ...idFilter, ...securityFilter });

        if (!docToUpdate) throw new RuntimeError(ErrorCodes.RESOURCE_NOT_FOUND, 404);

        const teamId = await this.getTeamId(req, docToUpdate);
        if (teamId) {
            await this.authorize(req, teamId, Action.UPDATE);
        }

        let data = this.allowedFields.length > 0
            ? filterObject(req.body, ...this.allowedFields)
            : req.body;

        data = await this.onBeforeUpdate(data, req, docToUpdate);
        const updatedDoc = await this.model.findOneAndUpdate(
            { _id: docToUpdate._id },
            data,
            { new: true, runValidators: true }
        );

        if (updatedDoc) await this.onAfterUpdate(updatedDoc, req);

        res.status(200).json({
            status: 'success',
            data: updatedDoc
        });
    });

    public deleteOne = catchAsync(async (req: Request, res: Response) => {
        if (!req.params.id) throw new RuntimeError(ErrorCodes.VALIDATION_ID_REQUIRED, 400);

        const idFilter = checkIfSlugOrId(req.params.id);
        const securityFilter = await this.getFilter(req);
        const doc = await this.model.findOne({ ...idFilter, ...securityFilter });

        if (!doc) throw new RuntimeError(ErrorCodes.RESOURCE_NOT_FOUND, 404);

        const teamId = await this.getTeamId(req, doc);
        if (teamId) {
            await this.authorize(req, teamId, Action.DELETE);
        }

        await this.onBeforeDelete(doc, req);
        await this.model.deleteOne({ _id: doc._id });

        res.status(204).json({
            status: 'success',
            data: null
        });
    });
}

