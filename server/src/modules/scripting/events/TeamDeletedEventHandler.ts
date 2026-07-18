import ScriptingService from '@modules/scripting/services/ScriptingService';
import ScriptingNotebookModel from '@modules/scripting/models/ScriptingNotebookModel';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

interface NotebookIdRecord {
    readonly _id: string;
}

/**
 * On team deletion, cascade-delete every scripting notebook belonging to the
 * team. Enumerates ids straight from the Mongoose {@link ScriptingNotebookModel}
 * and delegates the real teardown (runtime container + credential + event) to a
 * `new ScriptingService()` — no use case, no repository, no DI.
 */
@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<NotebookIdRecord> {
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
