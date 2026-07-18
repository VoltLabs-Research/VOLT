import { DeleteScriptingNotebookUseCase } from '@modules/scripting/use-cases/DeleteScriptingNotebookUseCase';
import type ScriptingNotebook from '@modules/scripting/entities/ScriptingNotebook';
import type { IScriptingNotebookRepository } from '@modules/scripting/ports/IScriptingNotebookRepository';
import { SCRIPTING_TOKENS } from '@modules/scripting/di/ScriptingTokens';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<ScriptingNotebook> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository) protected readonly repository: IScriptingNotebookRepository,
        private readonly deleteScriptingNotebookUseCase: DeleteScriptingNotebookUseCase
    ) {
        super();
    }

    protected async deleteOne(notebookId: string, event: TeamDeletedEvent): Promise<void> {
        await this.deleteScriptingNotebookUseCase.execute({
            notebookId,
            teamId: event.payload.teamId
        });
    }
}
