import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import {
    ListSimulationCellsByTeamIdInputDTO,
    ListSimulationCellsByTeamIdOutputDTO
} from '@modules/simulation-cell/application/dtos/ListSimulationCellsByTeamIdDTO';
import { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';

@injectable()
export default class ListSimulationCellsByTeamIdUseCase implements IUseCase<ListSimulationCellsByTeamIdInputDTO, ListSimulationCellsByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        private readonly repository: ISimulationCellRepository
    ){}

    async execute(input: ListSimulationCellsByTeamIdInputDTO): Promise<Result<ListSimulationCellsByTeamIdOutputDTO, ApplicationError>> {
        const { teamId, page = 1, limit = 10, trajectoryId, timestep } = input;

        const filter = {
            team: teamId,
            ...(trajectoryId ? { trajectory: trajectoryId } : {}),
            ...(timestep !== undefined ? { timestep } : {})
        };

        const result = await this.repository.findAll({
            filter,
            populate: { path: 'trajectory', select: ['name'] },
            page,
            limit
        });

        return Result.ok({
            ...result,
            data: result.data.map((cell) => toPersistedOutput(cell))
        });
    }
}
