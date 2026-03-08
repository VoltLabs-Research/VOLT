import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import type { GetSimulationCellByIdInputDTO } from '@modules/simulation-cell/application/dtos/GetSimulationCellByIdDTO';
import type { GetSimulationCellByIdOutputDTO } from '@modules/simulation-cell/application/dtos/GetSimulationCellByIdDTO';

@injectable()
export default class GetSimulationCellByIdUseCase implements IUseCase<GetSimulationCellByIdInputDTO, GetSimulationCellByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        private readonly repository: ISimulationCellRepository
    ) {}

    async execute(input: GetSimulationCellByIdInputDTO): Promise<Result<GetSimulationCellByIdOutputDTO, ApplicationError>> {
        const entity = await this.repository.findById(input.simulationCellId, {
            populate: { path: 'trajectory', select: ['name'] }
        });
        if (!entity) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SIMULATION_CELL_NOT_FOUND,
                'SimulationCell not found'
            ));
        }
        return Result.ok(toPersistedOutput(entity));
    }
}
