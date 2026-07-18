import PluginRepository from '@modules/plugin/services/PluginRepository';
import PluginService from '@modules/plugin/services/PluginService';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';

import type Plugin from '@modules/plugin/entities/plugin/Plugin';

class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Plugin> {
    protected readonly repository = new PluginRepository();
    #service = new PluginService();

    protected async deleteOne(pluginId: string): Promise<void> {
        await this.#service.deletePluginById({ pluginId });
    }
}

const teamDeletedEventHandler = new TeamDeletedEventHandler();
subscribeHandler('team.deleted', teamDeletedEventHandler);

export default teamDeletedEventHandler;
