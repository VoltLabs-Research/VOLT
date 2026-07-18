import PluginRepository from '@modules/plugin/services/PluginRepository';
import PluginService from '@modules/plugin/services/PluginService';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';

import type Plugin from '@modules/plugin/entities/plugin/Plugin';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Plugin> {
    protected readonly repository = new PluginRepository();
    #service = new PluginService();

    protected async deleteOne(pluginId: string): Promise<void> {
        await this.#service.deletePluginById({ pluginId });
    }
}
