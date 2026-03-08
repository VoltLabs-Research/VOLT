import path from 'node:path';
import fs from 'node:fs/promises';
import { inject, injectable } from 'tsyringe';
import { STATIC_ROOT } from '@core/config/paths';
import logger from '@shared/infrastructure/logger';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import type {
    DefaultPluginBootstrapResult,
    IDefaultPluginBootstrapService
} from '@modules/plugin/domain/port/IDefaultPluginBootstrapService';
import type { IPluginStorageService } from '@modules/plugin/domain/port/IPluginStorageService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

const DEFAULT_PLUGINS_PATH = path.join(STATIC_ROOT, 'default/plugins');

@injectable()
export class DefaultPluginBootstrapService implements IDefaultPluginBootstrapService {
    constructor(
        @inject(PLUGIN_TOKENS.PluginStorageService)
        private readonly pluginStorageService: IPluginStorageService
    ) {}

    async importDefaultPluginsForTeam(
        teamId: string,
        status: PluginStatus = PluginStatus.Published
    ): Promise<DefaultPluginBootstrapResult> {
        const files = await fs.readdir(DEFAULT_PLUGINS_PATH);
        const zipFiles = files.filter((file) => file.endsWith('.zip'));

        if (zipFiles.length === 0) {
            return {
                totalFound: 0,
                importedCount: 0,
                failedPlugins: []
            };
        }

        let importedCount = 0;
        const failedPlugins: string[] = [];

        for (const zipFile of zipFiles) {
            try {
                const filePath = path.join(DEFAULT_PLUGINS_PATH, zipFile);
                const fileBuffer = await fs.readFile(filePath);

                await this.pluginStorageService.importPlugin(fileBuffer, teamId, status);

                importedCount += 1;
                logger.info(`@default-plugin-bootstrap: imported plugin ${zipFile} for team ${teamId}`);
            } catch (error) {
                logger.error(`@default-plugin-bootstrap: failed to import ${zipFile}: ${error}`);
                failedPlugins.push(zipFile);
            }
        }

        return {
            totalFound: zipFiles.length,
            importedCount,
            failedPlugins
        };
    }
}
