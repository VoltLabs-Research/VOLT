import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import TeamCreatedEvent from '@modules/team/domain/events/TeamCreatedEvent';
import { IPluginStorageService } from '@modules/plugin/domain/ports/IPluginStorageService';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import CreateNotificationUseCase from '@modules/notification/application/use-cases/CreateNotificationUseCase';
import logger from '@shared/infrastructure/logger';
import path from 'node:path';
import fs from 'node:fs/promises';

const DEFAULT_PLUGINS_PATH = path.join(__dirname, '../../../../..', 'static/default/plugins');

@injectable()
export default class TeamCreatedEventHandler implements IEventHandler<TeamCreatedEvent> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginStorageService)
        private readonly pluginStorageService: IPluginStorageService,

        @inject(CreateNotificationUseCase)
        private readonly createNotificationUseCase: CreateNotificationUseCase
    ){}

    async handle(event: TeamCreatedEvent): Promise<void> {
        const { teamId, ownerId } = event.payload;

        try {
            const files = await fs.readdir(DEFAULT_PLUGINS_PATH);
            const zipFiles = files.filter((file) => file.endsWith('.zip'));

            if (zipFiles.length === 0) {
                logger.info(`@team-created-handler: no default plugins found`);
                return;
            }

            let importedCount = 0;
            const failedPlugins: string[] = [];

            for (const zipFile of zipFiles) {
                try {
                    const filePath = path.join(DEFAULT_PLUGINS_PATH, zipFile);
                    const fileBuffer = await fs.readFile(filePath);

                    await this.pluginStorageService.importPlugin(
                        fileBuffer,
                        teamId,
                        PluginStatus.Published
                    );

                    importedCount++;
                    logger.info(`@team-created-handler: imported plugin ${zipFile} for team ${teamId}`);
                } catch (error) {
                    logger.error(`@team-created-handler: failed to import ${zipFile}: ${error}`);
                    failedPlugins.push(zipFile);
                }
            }

            await this.createNotificationUseCase.execute({
                recipient: ownerId,
                title: 'Default Plugins Imported',
                content: `${importedCount} default plugin(s) have been imported to your new team.${failedPlugins.length > 0 ? ` ${failedPlugins.length} failed.` : ''}`,
                link: '/plugins'
            });

            logger.info(`@team-created-handler: completed importing ${importedCount}/${zipFiles.length} plugins for team ${teamId}`);
        } catch (error) {
            logger.error(`@team-created-handler: error importing default plugins: ${error}`);
        }
    }
}
