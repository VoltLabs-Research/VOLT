import { injectable, inject } from 'tsyringe';
import { DeleteManyOnTrajectoryDeletedHandler } from '@shared/application/events/DeleteManyOnTrajectoryDeletedHandler';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { ISimulationCellRepository } from '@modules/simulation-cell/domain/ports/ISimulationCellRepository';

@injectable()
export default class TrajectoryDeletedEventHandler extends DeleteManyOnTrajectoryDeletedHandler {
    protected readonly repository: ISimulationCellRepository;

    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        simulationCellRepository: ISimulationCellRepository
    ){
        super();
        this.repository = simulationCellRepository;
    }
}
