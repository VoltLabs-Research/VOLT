import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import TeamCreatedEvent from '@modules/team/domain/events/TeamCreatedEvent';
import type { IDefaultPluginBootstrapService } from '@modules/plugin/domain/port/IDefaultPluginBootstrapService';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import CreateNotificationUseCase from '@modules/notification/application/use-cases/CreateNotificationUseCase';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class TeamCreatedEventHandler implements IEventHandler<TeamCreatedEvent> {
    constructor(
        @inject(PLUGIN_TOKENS.DefaultPluginBootstrapService)
        private readonly defaultPluginBootstrapService: IDefaultPluginBootstrapService,

        @inject(CreateNotificationUseCase)
        private readonly createNotificationUseCase: CreateNotificationUseCase
    ){}

    async handle(event: TeamCreatedEvent): Promise<void> {
        const { teamId, ownerId } = event.payload;

        try {
            const result = await this.defaultPluginBootstrapService.importDefaultPluginsForTeam(
                teamId,
                PluginStatus.Published
            );

            if (result.totalFound === 0) {
                logger.info(`@team-created-handler: no default plugins found`);
                return;
            }

            await this.createNotificationUseCase.execute({
                recipient: ownerId,
                title: 'Default Plugins Imported',
                content: `${result.importedCount} default plugin(s) have been imported to your new team.${result.failedPlugins.length > 0 ? ` ${result.failedPlugins.length} failed.` : ''}`,
                link: '/plugins'
            });

            logger.info(`@team-created-handler: completed importing ${result.importedCount}/${result.totalFound} plugins for team ${teamId}`);
        } catch (error) {
            logger.error(`@team-created-handler: error importing default plugins: ${error}`);
        }
    }
}
