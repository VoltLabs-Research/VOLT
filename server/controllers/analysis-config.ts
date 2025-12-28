import { Request } from 'express';
import { Analysis } from '@/models';
import { Resource } from '@/constants/resources';
import BaseController from '@/controllers/base-controller';
import { FilterQuery } from 'mongoose';

export default class AnalysisConfigController extends BaseController<any> {
    constructor() {
        super(Analysis, {
            resource: Resource.ANALYSIS,
            fields: ['createdBy']
        });
    }
    
    /*
    protected async getFilter(req: Request): Promise<FilterQuery<any>> {
        const teamId = await this.getTeamId(req);
        return { team: teamId };
    }*/
};
