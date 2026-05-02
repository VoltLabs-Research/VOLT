import type {
    GetSimulationCellByTrajectoryInputDTO,
    GetSimulationCellByTrajectoryOutputDTO
} from '@modules/simulation-cell/application/dtos/GetSimulationCellByTrajectoryDTO';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import SimulationCellRepository from '@modules/simulation-cell/infrastructure/persistence/mongo/repositories/SimulationCellRepository';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { TRAJECTORY_POPULATE } from '@shared/application/PopulatePresets';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class GetSimulationCellByTrajectoryUseCase {
    constructor(
        private readonly repository: SimulationCellRepository
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
