import { injectable, inject } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/TrajectoryDeletedEvent';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/ports/IScriptingNotebookRepository';

import { JupyterService } from '@modules/scripting/infrastructure/services/JupyterService';

@injectable()
export default class TrajectoryDeletedEventHandler implements IEventHandler<TrajectoryDeletedEvent> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository,

        @inject(JupyterService)
        private readonly jupyterService: JupyterService
    ){}

    async handle(event: TrajectoryDeletedEvent): Promise<void> {
        const { trajectoryId } = event.payload;
        await this.scriptingNotebookRepository.removeTrajectory(trajectoryId);
        await this.jupyterService.deleteSession(trajectoryId);
    }
}
