import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import type { IScriptingSessionOrchestrator } from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository) private readonly scriptingNotebookRepository: IScriptingNotebookRepository,
        @inject(SCRIPTING_TOKENS.ScriptingSessionOrchestrator) private readonly scriptingSessionOrchestrator: IScriptingSessionOrchestrator
    ) {}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId } = event.payload;
        await this.scriptingSessionOrchestrator.deleteSession(trajectoryId);
        await this.scriptingNotebookRepository.removeTrajectory(trajectoryId);
    }
}
