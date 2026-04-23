import { DeleteScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/DeleteScriptingNotebookUseCase';
import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import ScriptingNotebookRepository from '@modules/scripting/infrastructure/persistence/mongo/repositories/ScriptingNotebookRepository';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<ScriptingNotebook> {
    constructor(
        
        protected readonly repository: ScriptingNotebookRepository,

        
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
