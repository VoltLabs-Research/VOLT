import type {
    GetSimulationCellByTrajectoryInputDTO,
    GetSimulationCellByTrajectoryOutputDTO
} from '@modules/simulation-cell/application/dtos/GetSimulationCellByTrajectoryDTO';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { TRAJECTORY_POPULATE } from '@shared/application/PopulatePresets';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class GetSimulationCellByTrajectoryUseCase {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository) private readonly repository: ISimulationCellRepository
    ) {}

    async execute(
        input: GetSimulationCellByTrajectoryInputDTO
    ): Promise<Result<GetSimulationCellByTrajectoryOutputDTO, ApplicationError>> {
        const baseFilter: Partial<SimulationCellProps> = {
            team: input.teamId,
            trajectory: input.trajectoryId
        };

        if (input.timestep !== undefined) {
            const exactMatch = await this.repository.findOne(
                {
                    ...baseFilter,
                    timestep: input.timestep
                },
                { populate: TRAJECTORY_POPULATE }
            );

            if (exactMatch) {
                return Result.ok(toPersistedOutput(exactMatch));
            }
        }

        const fallbackResult = await this.repository.findAll({
            filter: baseFilter,
            populate: TRAJECTORY_POPULATE,
            sort: { timestep: -1 },
            limit: 1,
            page: 1
        });

        const fallbackEntity = fallbackResult.data[0];
        const simulationCell: GetSimulationCellByTrajectoryOutputDTO = fallbackEntity
            ? toPersistedOutput(fallbackEntity)
            : null;

        return Result.ok(simulationCell);
    }
}
