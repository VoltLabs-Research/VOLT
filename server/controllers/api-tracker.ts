import { Request } from 'express';
import { FilterQuery } from 'mongoose';
import { ApiTracker } from '@/models/index';
import type { IApiTracker } from '@/models/api-tracker';
import BaseController from '@/controllers/base-controller';
import { Resource } from '@/constants/resources';

export default class ApiTrackerController extends BaseController<IApiTracker> {
    constructor() {
        super(ApiTracker, {
            resource: Resource.API_TRACKER,
            fields: ['method', 'url', 'ip', 'userAgent', 'statusCode', 'responseTime', 'requestBody', 'queryParams', 'headers', 'createdAt']
        });
    }

    protected async getFilter(req: Request): Promise<FilterQuery<IApiTracker>> {
        return { user: (req as any).user._id };
    }
}
