import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import FindCellsByTeamIdUseCase from '@modules/simulation-cell/application/use-cases/FindCellsByTeamIdUseCase';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';

@injectable()
export default class ListSimulationCellsController extends BaseController<FindCellsByTeamIdUseCase> {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.FindCellsByTeamIdUseCase) useCase: FindCellsByTeamIdUseCase
    ) {
        super(useCase);
    }
}
