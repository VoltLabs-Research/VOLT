import { Analysis, Trajectory } from '@/models';
import { Resource } from '@/constants/resources';
import BaseController from '@/controllers/base-controller';
import { Request } from 'express';
import { FilterQuery } from 'mongoose';
import mongoose from 'mongoose';

export default class AnalysisConfigController extends BaseController<any> {
    constructor() {
        super(Analysis, {
            resource: Resource.ANALYSIS,
            fields: ['createdBy'],
            populate: { path: 'trajectory', select: 'name' }
        });
    }

    protected async getFilter(req: Request): Promise<FilterQuery<any>> {
        const teamId = await this.getTeamId(req);

        // Validate teamId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(teamId)) {
            return { _id: new mongoose.Types.ObjectId() }; // Return impossible filter
        }

        // Find all trajectories that belong to this team
        const trajectories = await Trajectory.find({ team: teamId }).select('_id');
        const trajectoryIds = trajectories.map(t => t._id);

        // Filter analyses by trajectory IDs
        return { trajectory: { $in: trajectoryIds } };
    }
};
