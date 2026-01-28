import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/TrajectoryDeletedEvent';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { ISimulationCellRepository } from '@modules/simulation-cell/domain/ports/ISimulationCellRepository';

@injectable()
export default class TrajectoryDeletedEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        private readonly simulationCellRepository: ISimulationCellRepository
    ){}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId } = event.payload;
        await this.simulationCellRepository.deleteMany({ trajectory: trajectoryId });
    }
}
