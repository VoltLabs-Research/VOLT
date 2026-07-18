import { SCRIPTING_TOKENS } from '@modules/scripting/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/ports/IScriptingNotebookRepository';
import type { IScriptingSessionOrchestrator } from '@modules/scripting/ports/IScriptingSessionOrchestrator';
import type { INotebookCredentialService } from '@modules/scripting/ports/INotebookCredentialService';
import type { TrajectoryDeletedEventPayload } from '@shared/contracts/events';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedEventHandler implements IEventHandler<IDomainEvent<TrajectoryDeletedEventPayload>> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository) private readonly scriptingNotebookRepository: IScriptingNotebookRepository,
        @inject(SCRIPTING_TOKENS.ScriptingSessionOrchestrator) private readonly scriptingSessionOrchestrator: IScriptingSessionOrchestrator,
        @inject(SCRIPTING_TOKENS.NotebookCredentialService) private readonly notebookCredentialService: INotebookCredentialService
    ) {}

    async handle(event: IDomainEvent<TrajectoryDeletedEventPayload>): Promise<void> {
        const { trajectoryId } = event.payload;
        const notebooks = await this.scriptingNotebookRepository.findAllWithTrajectory(trajectoryId);
        await this.scriptingSessionOrchestrator.deleteSession(trajectoryId);
        for (const notebook of notebooks) {
            await this.notebookCredentialService.revokeSecretKey(notebook);
        }
        await this.scriptingNotebookRepository.removeTrajectory(trajectoryId);
    }
}
