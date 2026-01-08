
import { Request } from 'express';
import BaseController from '@controllers/base-controller';
import SimulationCell from '@/models/trajectory/simulation-cell';
import { Resource } from '@/constants/resources';
import { ISimulationCell } from '@/types/models/simulation-cell';

export default class SimulationCellController extends BaseController<ISimulationCell> {
    constructor() {
        super(SimulationCell, {
            resource: Resource.SIMULATION_CELL,
            fields: ['boundingBox', 'geometry', 'team', 'timestep', 'trajectory'],
            populate: [
                { path: 'trajectory', select: 'name' }
            ]
        });
    }

    protected async getFilter(req: Request) {
        return {
            team: req.params.teamId
        };
    }
}
