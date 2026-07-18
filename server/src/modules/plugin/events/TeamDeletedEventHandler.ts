import PluginModel from '@modules/plugin/models/plugin/PluginModel';
import PluginService from '@modules/plugin/services/PluginService';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';

interface PluginIdRecord {
    readonly _id: string;
}

class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<PluginIdRecord> {
    protected readonly repository = {
        export: async ({ filter }: { filter: Record<string, string>; select?: string[] }): Promise<PluginIdRecord[]> => {
            const docs = await PluginModel.find(filter).select('_id').exec();
            return docs.map((doc) => ({ _id: String(doc._id) }));
        }
    };

    #service = new PluginService();

    protected async deleteOne(pluginId: string): Promise<void> {
        await this.#service.deletePluginById({ pluginId });
    }
}

const teamDeletedEventHandler = new TeamDeletedEventHandler();
subscribeHandler('team.deleted', teamDeletedEventHandler);

export default teamDeletedEventHandler;
