import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Param, Query } from '@shared/http/params';
import { teamScoped } from '@modules/team/controllers/middleware/team-scoped';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { Resource } from '@core/constants/resources';
import simulationCellService from '@modules/simulation-cell/services/SimulationCellService';
import { simulationCellRoutes } from '@volt/contracts/modules/simulation-cell/routes';

@Middleware(protect, teamScoped(Resource.SIMULATION_CELL))
export default class SimulationCellController extends Controller {
    @Route(simulationCellRoutes.list)
    list(
        @Param('teamId') teamId: string,
        @Query() query: Record<string, string>
    ){
        return simulationCellService.list({
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
        return simulationCellService.getByTrajectory({
            teamId,
            trajectoryId,
            timestep: timestep !== undefined ? Number(timestep) : undefined
        });
    }

    @Route(simulationCellRoutes.get)
    getById(@Param('simulationCellId') simulationCellId: string) {
        return simulationCellService.getById(simulationCellId);
    }
}
