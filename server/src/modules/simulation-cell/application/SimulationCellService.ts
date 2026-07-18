import { ErrorCodes } from '@core/constants/error-codes';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import GetSimulationCellByTrajectoryUseCase from '@modules/simulation-cell/application/use-cases/GetSimulationCellByTrajectoryUseCase';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    GetSimulationCellByTrajectoryInputDTO,
    GetSimulationCellByTrajectoryOutputDTO
} from '@shared/contracts/dtos/GetSimulationCellByTrajectoryDTO';
import type { ISimulationCellRepository } from '@shared/contracts/ports/ISimulationCellRepository';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { PersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { TRAJECTORY_POPULATE } from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import { inject } from 'tsyringe';

interface ListSimulationCellsInput {
    teamId: string;
    page?: string;
    limit?: string;
    trajectoryId?: string;
    timestep?: string;
}

interface GetSimulationCellByIdInput {
    simulationCellId: string;
}

/**
 * The single application service for the simulation-cell module. `list` and
 * `getById` fold the logic that previously lived inline in the route handlers
 * (verbatim, on the thrown-`ApplicationError` channel). `getByTrajectory`
 * delegates to the retained {@link GetSimulationCellByTrajectoryUseCase}, which
 * implements the cross-module `IGetSimulationCellByTrajectoryUseCase` port
 * (`SIMULATION_CELL_CONTRACT_TOKENS.GetSimulationCellByTrajectoryUseCase`) and is
 * also consumed by the get-simulation-cell AI tool — so it is kept as its own
 * class and merely unwrapped here.
 */
@Singleton(SIMULATION_CELL_TOKENS.SimulationCellService)
export default class SimulationCellService {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository) private readonly repository: ISimulationCellRepository,
        @inject(GetSimulationCellByTrajectoryUseCase) private readonly getByTrajectoryUseCase: GetSimulationCellByTrajectoryUseCase
    ) {}

    async list(input: ListSimulationCellsInput): Promise<PaginatedResult<PersistedOutput<SimulationCellProps>>> {
        const page = input.page !== undefined ? Number(input.page) : 1;
        const limit = input.limit !== undefined ? Number(input.limit) : 10;
        const filter: Partial<SimulationCellProps> = { team: input.teamId };

        if (input.trajectoryId) {
            filter.trajectory = input.trajectoryId;
        }

        if (input.timestep !== undefined) {
            filter.timestep = Number(input.timestep);
        }

        const result = await this.repository.findAll({
            filter,
            populate: TRAJECTORY_POPULATE,
            page,
            limit
        });

        return {
            ...result,
            data: result.data.map((cell) => toPersistedOutput(cell))
        };
    }

    async getByTrajectory(input: GetSimulationCellByTrajectoryInputDTO): Promise<GetSimulationCellByTrajectoryOutputDTO> {
        const result = await this.getByTrajectoryUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async getById(input: GetSimulationCellByIdInput): Promise<PersistedOutput<SimulationCellProps>> {
        const simulationCell = await this.repository.findById(input.simulationCellId, {
            populate: TRAJECTORY_POPULATE
        });

        if (!simulationCell) {
            throw ApplicationError.notFound(
                ErrorCodes.SIMULATION_CELL_NOT_FOUND,
                'SimulationCell not found'
            );
        }

        return toPersistedOutput(simulationCell);
    }
}
