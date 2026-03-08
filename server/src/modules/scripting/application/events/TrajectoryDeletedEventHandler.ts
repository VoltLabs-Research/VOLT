import { injectable, inject } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/TrajectoryDeletedEvent';
import { SCRIPTING_TOKENS } from '@modules/scripting/application/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import type { IScriptingSessionOrchestrator } from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';

@injectable()
export default class TrajectoryDeletedEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository,

        @inject(SCRIPTING_TOKENS.ScriptingSessionOrchestrator)
        private readonly scriptingSessionOrchestrator: IScriptingSessionOrchestrator
    ){}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId } = event.payload;
        await this.scriptingNotebookRepository.removeTrajectory(trajectoryId);
        await this.scriptingSessionOrchestrator.deleteSession(trajectoryId);
    }
}
