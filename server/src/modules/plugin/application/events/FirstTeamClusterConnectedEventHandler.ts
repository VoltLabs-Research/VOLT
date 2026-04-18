import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import FirstTeamClusterConnectedEvent from '@modules/team-cluster/domain/events/FirstTeamClusterConnectedEvent';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { IDefaultPluginBootstrapService } from '@modules/plugin/domain/port/plugin/IDefaultPluginBootstrapService';

@injectable()
export default class FirstTeamClusterConnectedEventHandler implements IEventHandler<FirstTeamClusterConnectedEvent> {
    constructor(
        @inject(PLUGIN_TOKENS.DefaultPluginBootstrapService)
        private readonly defaultPluginBootstrapService: IDefaultPluginBootstrapService
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
