import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { FindCellByIdInputDTO, FindCellByIdOutputDTO } from '../dtos/FindCellByIdDTO';
import { ISimulationCellRepository } from '../../domain/ports/ISimulationCellRepository';
import { SIMULATION_CELL_TOKENS } from '../../infrastructure/di/SimulationCellTokens';

@injectable()
export default class FindCellByIdUseCase implements IUseCase<FindCellByIdInputDTO, FindCellByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        private readonly repository: ISimulationCellRepository
    ) { }

    async execute(input: FindCellByIdInputDTO): Promise<Result<FindCellByIdOutputDTO, ApplicationError>> {
        const cell = await this.repository.findById(input.id, { populate: 'trajectory' });

        if (!cell) {
            return Result.fail(ApplicationError.notFound('SIMULATION_CELL_NOT_FOUND', 'SimulationCell not found'));
        }

        return Result.ok(cell.props);
    }
}
