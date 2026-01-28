import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import TeamDeletedEvent from '@modules/team/domain/events/TeamDeletedEvent';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { ISimulationCellRepository } from '@modules/simulation-cell/domain/ports/ISimulationCellRepository';

@injectable()
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    constructor(
        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        private readonly simulationCellRepository: ISimulationCellRepository
    ){}

    async handle(event: TeamDeletedEvent): Promise<void> {
        const { teamId } = event.payload;
        await this.simulationCellRepository.deleteMany({ team: teamId });
    }
}
