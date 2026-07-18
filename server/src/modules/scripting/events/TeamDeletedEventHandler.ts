import ScriptingService from '@modules/scripting/services/ScriptingService';
import ScriptingNotebookModel from '@modules/scripting/models/ScriptingNotebookModel';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

interface NotebookIdRecord {
    readonly _id: string;
}

class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<NotebookIdRecord> {
    protected readonly repository = {
        export: async ({ filter }: { filter: Record<string, string>; select?: string[] }): Promise<NotebookIdRecord[]> => {
            const docs = await ScriptingNotebookModel.find(filter).select('_id').exec();
            return docs.map((doc) => ({ _id: String(doc._id) }));
        }
    };

    #service?: ScriptingService;

    protected async deleteOne(notebookId: string, event: TeamDeletedEvent): Promise<void> {
        this.#service ??= new ScriptingService();
        await this.#service.deleteNotebook({ notebookId, teamId: event.payload.teamId });
    }
}

const teamDeletedEventHandler = new TeamDeletedEventHandler();
subscribeHandler('team.deleted', teamDeletedEventHandler);

export default teamDeletedEventHandler;
