import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import FindCellsByTeamIdUseCase from '../../../application/use-cases/FindCellsByTeamIdUseCase';
import { SIMULATION_CELL_TOKENS } from '../../di/SimulationCellTokens';

@injectable()
export default class ListSimulationCellsController extends BaseController<FindCellsByTeamIdUseCase> {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.FindCellsByTeamIdUseCase) useCase: FindCellsByTeamIdUseCase
    ) {
        super(useCase);
    }
}
