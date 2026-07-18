import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import WhiteboardModel from '@modules/whiteboards/models/WhiteboardModel';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

interface WhiteboardIdRecord {
    readonly _id: string;
}

/**
 * On team deletion, cascade-delete every whiteboard belonging to the team.
 * Enumerates ids straight from the Mongoose {@link WhiteboardModel} and delegates
 * the real teardown (object-storage cleanup + `whiteboard.deleted` event) to a
 * `new WhiteboardService()` — no use case, no repository, no DI.
 */
@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<WhiteboardIdRecord> {
    protected readonly repository = {
        export: async ({ filter }: { filter: Record<string, string>; select?: string[] }): Promise<WhiteboardIdRecord[]> => {
            const docs = await WhiteboardModel.find(filter).select('_id').exec();
            return docs.map((doc) => ({ _id: String(doc._id) }));
        }
    };

    #service?: WhiteboardService;

    protected async deleteOne(whiteboardId: string, event: TeamDeletedEvent): Promise<void> {
        this.#service ??= new WhiteboardService();
        await this.#service.deleteWhiteboard(event.payload.teamId, whiteboardId, event.payload.userId ?? '');
    }
}
