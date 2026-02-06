import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import FindCellByIdUseCase from '@modules/simulation-cell/application/use-cases/FindCellByIdUseCase';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';

@injectable()
export default class FindCellByIdController extends BaseController<FindCellByIdUseCase> {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.FindCellByIdUseCase) useCase: FindCellByIdUseCase
    ) {
        super(useCase);
    }
}
