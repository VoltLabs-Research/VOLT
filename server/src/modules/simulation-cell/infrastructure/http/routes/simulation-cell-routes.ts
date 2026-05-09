import { ErrorCodes } from '@core/constants/error-codes';
import { Resource } from '@core/constants/resources';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import GetSimulationCellByTrajectoryController from '@modules/simulation-cell/infrastructure/http/controllers/GetSimulationCellByTrajectoryController';
import { simulationCellValidationSchemas } from '@modules/simulation-cell/infrastructure/http/validation/simulation-cell-schemas';
import SimulationCellRepository from '@modules/simulation-cell/infrastructure/persistence/mongo/repositories/SimulationCellRepository';
import { TRAJECTORY_POPULATE } from '@shared/application/PopulatePresets';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
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
        router.get('/', createValidationMiddleware(simulationCellValidationSchemas.listByTeamId), async (req, res) => {
            const { teamId } = req.params as { teamId: string };
            const {
                page = 1,
                limit = 10,
                trajectoryId,
                timestep
            } = req.query as unknown as {
                page?: number;
                limit?: number;
                trajectoryId?: string;
                timestep?: number;
            };
            const filter: Partial<SimulationCellProps> = { team: teamId };

            if (trajectoryId) {
                filter.trajectory = trajectoryId;
            }

            if (timestep !== undefined) {
                filter.timestep = timestep;
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
            createValidationMiddleware(simulationCellValidationSchemas.getByTrajectory),
            getByTrajectoryController.handle
        );

        router.get('/:simulationCellId', createValidationMiddleware(simulationCellValidationSchemas.getById), async (req, res) => {
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
