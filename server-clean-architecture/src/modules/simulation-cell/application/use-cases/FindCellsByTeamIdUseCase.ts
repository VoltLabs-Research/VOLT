import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { FindCellsByTeamIdInputDTO, FindCellsByTeamIdOutputDTO } from '../dtos/FindCellsByTeamIdDTO';
import { ISimulationCellRepository } from '../../domain/ports/ISimulationCellRepository';
import { SIMULATION_CELL_TOKENS } from '../../infrastructure/di/SimulationCellTokens';

@injectable()
export default class FindCellsByTeamIdUseCase implements IUseCase<FindCellsByTeamIdInputDTO, FindCellsByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        private readonly repository: ISimulationCellRepository
    ) { }

    async execute(input: FindCellsByTeamIdInputDTO): Promise<Result<FindCellsByTeamIdOutputDTO, ApplicationError>> {
        const { teamId, page = 1, limit = 10 } = input;

        const result = await this.repository.findAll({
            filter: { team: teamId },
            populate: 'trajectory',
            page,
            limit
        });

        // The repository returns a PaginatedResult<SimulationCell> (domain objects)
        // We need to map the data to props
        return Result.ok({
            ...result,
            data: result.data.map(cell => cell.props)
        });
    }
}
