import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import type {
    ListSimulationCellsByTeamIdInputDTO,
    ListSimulationCellsByTeamIdOutputDTO
} from '@modules/simulation-cell/application/dtos/ListSimulationCellsByTeamIdDTO';
import type { SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';

@injectable()
export default class ListSimulationCellsByTeamIdUseCase implements IUseCase<ListSimulationCellsByTeamIdInputDTO, ListSimulationCellsByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        private readonly repository: ISimulationCellRepository
    ) {}

    async execute(input: ListSimulationCellsByTeamIdInputDTO): Promise<Result<ListSimulationCellsByTeamIdOutputDTO, ApplicationError>> {
        const { teamId, page = 1, limit = 10, trajectoryId, timestep } = input;

        const filter: Partial<SimulationCellProps> = {
            team: teamId
        };

        if (trajectoryId) {
            filter.trajectory = trajectoryId;
        }

        if (timestep !== undefined) {
            filter.timestep = timestep;
        }

        const result = await this.repository.findAll({
            filter,
            populate: { path: 'trajectory', select: ['name'] },
            page,
            limit
        });

        return Result.ok({
            ...result,
            data: result.data.map(toPersistedOutput)
        });
    }
};
