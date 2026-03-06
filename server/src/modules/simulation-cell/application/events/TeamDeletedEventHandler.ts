import { injectable, inject } from 'tsyringe';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        protected readonly repository: ISimulationCellRepository
    ) {
        super();
    }
}
