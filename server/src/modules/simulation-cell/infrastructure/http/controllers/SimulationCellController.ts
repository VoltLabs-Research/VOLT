import type SimulationCellService from '@modules/simulation-cell/application/SimulationCellService';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import type { GetSimulationCellByTrajectoryInputDTO } from '@shared/contracts/dtos/GetSimulationCellByTrajectoryDTO';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the simulation-cell module. One Express
 * handler per route, delegating to {@link SimulationCellService} and responding
 * via {@link BaseResponse}. `list` and `getById` preserve the original inline
 * route parsing verbatim; `getByTrajectory` assembles its input via
 * `buildControllerParams`, exactly as the former generated controller did.
 * Handlers are arrow-function properties so `this` stays bound when passed by
 * reference to the router.
 */
@injectable()
export default class SimulationCellController {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellService) private readonly simulationCellService: SimulationCellService
    ) {}

    list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { teamId } = req.params as { teamId: string };
        const {
            page,
            limit,
            trajectoryId,
            timestep
        } = req.query as {
            page?: string;
            limit?: string;
            trajectoryId?: string;
            timestep?: string;
        };

        const result = await this.simulationCellService.list({
            teamId,
            page,
            limit,
            trajectoryId,
            timestep
        });

        BaseResponse.paginated(res, result);
    };

    getByTrajectory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetSimulationCellByTrajectoryInputDTO;
        const value = await this.simulationCellService.getByTrajectory(input);
        BaseResponse.success(res, value);
    };

    getById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { simulationCellId } = req.params as { simulationCellId: string };
        const value = await this.simulationCellService.getById({ simulationCellId });
        BaseResponse.success(res, value);
    };
}
