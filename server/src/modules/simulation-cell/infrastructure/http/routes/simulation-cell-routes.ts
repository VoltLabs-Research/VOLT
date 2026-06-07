import { ErrorCodes } from '@core/constants/error-codes';
import { Resource } from '@core/constants/resources';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import GetSimulationCellByTrajectoryController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByTrajectoryController';
import SimulationCellRepository from '@modules/simulation-cell/infrastructure/persistence/mongo/repositories/SimulationCellRepository';
import { TRAJECTORY_POPULATE } from '@shared/application/PopulatePresets';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const getByTrajectoryController = container.resolve(GetSimulationCellByTrajectoryController);

export default createHttpModule({
    basePath: '/api/simulation-cells/:teamId',
    resource: Resource.SIMULATION_CELL,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/', async (req, res) => {
            const { teamId } = req.params as { teamId: string };
            const {
                page: pageRaw,
                limit: limitRaw,
                trajectoryId,
                timestep: timestepRaw
            } = req.query as {
                page?: string;
                limit?: string;
                trajectoryId?: string;
                timestep?: string;
            };
            const page = pageRaw !== undefined ? Number(pageRaw) : 1;
            const limit = limitRaw !== undefined ? Number(limitRaw) : 10;
            const filter: Partial<SimulationCellProps> = { team: teamId };

            if (trajectoryId) {
                filter.trajectory = trajectoryId;
            }

            if (timestepRaw !== undefined) {
                filter.timestep = Number(timestepRaw);
            }

            const repository = container.resolve(SimulationCellRepository);
            const result = await repository.findAll({
                filter,
                populate: TRAJECTORY_POPULATE,
                page,
                limit
            });

            BaseResponse.paginated(res, {
                ...result,
                data: result.data.map((cell) => toPersistedOutput(cell))
            });
        });

        router.get(
            '/trajectories/:trajectoryId',
            getByTrajectoryController.handle
        );

        router.get('/:simulationCellId', async (req, res) => {
            const { simulationCellId } = req.params as { simulationCellId: string };
            const repository = container.resolve(SimulationCellRepository);
            const simulationCell = await repository.findById(simulationCellId, {
                populate: TRAJECTORY_POPULATE
            });

            if (!simulationCell) {
                BaseResponse.error(
                    res,
                    'SimulationCell not found',
                    HttpStatus.NotFound,
                    ErrorCodes.SIMULATION_CELL_NOT_FOUND
                );
                return;
            }

            BaseResponse.success(res, toPersistedOutput(simulationCell));
        });
    }
});
