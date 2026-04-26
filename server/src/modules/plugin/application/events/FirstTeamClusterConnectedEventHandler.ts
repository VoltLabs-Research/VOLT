import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { DefaultPluginBootstrapService } from '@modules/plugin/infrastructure/services/plugin/DefaultPluginBootstrapService';
import FirstTeamClusterConnectedEvent from '@modules/cluster/domain/events/FirstTeamClusterConnectedEvent';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';

@Subscribe('team-cluster.first-connected')
export default class FirstTeamClusterConnectedEventHandler implements IEventHandler<FirstTeamClusterConnectedEvent> {
    constructor(
        
        private readonly defaultPluginBootstrapService: DefaultPluginBootstrapService
    ){}

    async handle(event: FirstTeamClusterConnectedEvent): Promise<void> {
        const { teamId, teamClusterId } = event.payload;

        try {
            const result = await this.defaultPluginBootstrapService.importDefaultPluginsForTeam(
                teamId,
                PluginStatus.Published
            );

            logger.info(`Processed default plugin bootstrap after the first team cluster connected failedPlugins=${result.failedPlugins.length} importedCount=${result.importedCount} teamClusterId=${teamClusterId} teamId=${teamId}`);
        } catch (error: unknown) {
            logger.error(`Failed to import default plugins after the first team cluster connected teamClusterId=${teamClusterId} teamId=${teamId}`);
        }
    }
};
