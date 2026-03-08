import { injectable, inject } from 'tsyringe';
import { Result } from '@shared/domain/port/Result';
import type ApplicationError from '@shared/application/errors/ApplicationErrors';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import type {
    GetSimulationCellByTrajectoryInputDTO,
    GetSimulationCellByTrajectoryOutputDTO
} from '@modules/simulation-cell/application/dtos/GetSimulationCellByTrajectoryDTO';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';

@injectable()
export default class GetSimulationCellByTrajectoryUseCase {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        private readonly repository: ISimulationCellRepository
    ){}

    async execute(
        input: GetSimulationCellByTrajectoryInputDTO
    ): Promise<Result<GetSimulationCellByTrajectoryOutputDTO, ApplicationError>> {
        const baseFilter: Partial<SimulationCellProps> = {
            team: input.teamId,
            trajectory: input.trajectoryId
        };

        const populate = { path: 'trajectory', select: ['name'] };

        if (input.timestep !== undefined) {
            const exactMatch = await this.repository.findOne(
                {
                    ...baseFilter,
                    timestep: input.timestep
                },
                { populate }
            );

            if (exactMatch) {
                return Result.ok(toPersistedOutput(exactMatch));
            }
        }

        const fallbackResult = await this.repository.findAll({
            filter: baseFilter,
            populate,
            sort: { timestep: -1 },
            limit: 1,
            page: 1
        });

        return Result.ok(fallbackResult.data[0] ? toPersistedOutput(fallbackResult.data[0]) : null);
    }
}
