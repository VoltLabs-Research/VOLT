import ContainerService from '@modules/container/services/ContainerService';
import { ContainerModel } from '@modules/container/models/ContainerModel';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

interface ContainerIdRecord {
    readonly _id: string;
}

/**
 * On team deletion, cascade-delete every container belonging to the team.
 * Enumerates ids straight from the Mongoose {@link ContainerModel} and delegates
 * the real teardown (docker + relays) to a `new ContainerService()` — no
 * use case, no repository, no DI.
 */
class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<ContainerIdRecord> {
    protected readonly repository = {
        export: async ({ filter }: { filter: Record<string, string>; select?: string[] }): Promise<ContainerIdRecord[]> => {
            const docs = await ContainerModel.find(filter).select('_id').exec();
            return docs.map((doc) => ({ _id: String(doc._id) }));
        }
    };

    #service?: ContainerService;

    protected async deleteOne(containerId: string, event: TeamDeletedEvent): Promise<void> {
        this.#service ??= new ContainerService();
        await this.#service.delete(event.payload.teamId, containerId, event.payload.userId ?? '');
    }
}

const teamDeletedEventHandler = new TeamDeletedEventHandler();
subscribeHandler('team.deleted', teamDeletedEventHandler);

export default teamDeletedEventHandler;
