import ScriptingNotebookRepository from '@modules/scripting/infrastructure/persistence/mongo/repositories/ScriptingNotebookRepository';
import { DaemonScriptingSessionOrchestrator } from '@modules/scripting/infrastructure/services/DaemonScriptingSessionOrchestrator';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        
        private readonly scriptingNotebookRepository: ScriptingNotebookRepository,

        
        private readonly scriptingSessionOrchestrator: DaemonScriptingSessionOrchestrator
    ) {}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId } = event.payload;
        await this.scriptingSessionOrchestrator.deleteSession(trajectoryId);
        await this.scriptingNotebookRepository.removeTrajectory(trajectoryId);
    }
};
