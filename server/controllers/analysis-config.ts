import { Analysis } from '@/models';
import { Resource } from '@/constants/resources';
import BaseController from '@/controllers/base-controller';

export default class AnalysisConfigController extends BaseController<any> {
    constructor() {
        super(Analysis, {
            resource: Resource.ANALYSIS,
            fields: ['createdBy'],
            populate: { path: 'trajectory', select: 'name' }
        });
    }
    
    /*
    protected async getFilter(req: Request): Promise<FilterQuery<any>> {
        const teamId = await this.getTeamId(req);
        return { team: teamId };
    }*/
};
