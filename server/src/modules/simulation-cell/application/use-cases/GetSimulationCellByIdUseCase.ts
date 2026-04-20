import { ErrorCodes } from '@core/constants/error-codes';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { injectable, inject } from 'tsyringe';
import type { GetSimulationCellByIdInputDTO, GetSimulationCellByIdOutputDTO } from '@modules/simulation-cell/application/dtos/GetSimulationCellByIdDTO';
import type { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';
import type { IUseCase } from '@shared/application/IUseCase';

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
};
