import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import FindCellByIdUseCase from '../../../application/use-cases/FindCellByIdUseCase';
import { SIMULATION_CELL_TOKENS } from '../../di/SimulationCellTokens';

@injectable()
export default class FindCellByIdController extends BaseController<FindCellByIdUseCase> {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.FindCellByIdUseCase) useCase: FindCellByIdUseCase
    ) {
        super(useCase);
    }
}
