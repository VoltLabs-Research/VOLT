import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { DeleteScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/DeleteScriptingNotebookUseCase';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { inject, injectable } from 'tsyringe';
import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';

@injectable()
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<ScriptingNotebook> {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        protected readonly repository: IScriptingNotebookRepository,

        @inject(DeleteScriptingNotebookUseCase)
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
};
