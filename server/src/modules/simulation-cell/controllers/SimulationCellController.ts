import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Param, Query } from '@shared/http/params';
import { teamScoped } from '@shared/http/guards';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import SimulationCellService from '@modules/simulation-cell/services/SimulationCellService';
import { simulationCellRoutes } from '@volt/contracts/modules/simulation-cell/routes';

@Middleware(protect, teamScoped(Resource.SIMULATION_CELL))
export default class SimulationCellController extends Controller {
    #service = new SimulationCellService();

    @Route(simulationCellRoutes.list)
    list(@Param('teamId') teamId: string, @Query() query: Record<string, string>) {
        return this.#service.list({
            teamId,
            page: query.page,
            limit: query.limit,
            trajectoryId: query.trajectoryId,
            timestep: query.timestep
        });
    }

    @Route(simulationCellRoutes.getByTrajectory)
    getByTrajectory(
        @Param('teamId') teamId: string,
        @Param('trajectoryId') trajectoryId: string,
        @Query('timestep') timestep: string | undefined
    ) {
        return this.#service.getByTrajectory({
            teamId,
            trajectoryId,
            timestep: timestep !== undefined ? Number(timestep) : undefined
        });
    }

    @Route(simulationCellRoutes.get)
    getById(@Param('simulationCellId') simulationCellId: string) {
        return this.#service.getById({ simulationCellId });
    }
}
