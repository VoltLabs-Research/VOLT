import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import { inject, injectable } from 'tsyringe';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import type { IScriptingSessionOrchestrator } from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class TrajectoryDeletedEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository,

        @inject(SCRIPTING_TOKENS.ScriptingSessionOrchestrator)
        private readonly scriptingSessionOrchestrator: IScriptingSessionOrchestrator
    ) {}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId } = event.payload;
        await this.scriptingSessionOrchestrator.deleteSession(trajectoryId);
        await this.scriptingNotebookRepository.removeTrajectory(trajectoryId);
    }
};
