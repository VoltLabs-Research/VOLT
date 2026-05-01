import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { STATIC_ROOT } from '@core/config/paths';
import logger from '@shared/infrastructure/logger';
import fs from 'node:fs/promises';
import path from 'node:path';
import unzipper from 'unzipper';

import type {
    DefaultPluginBootstrapResult,
    IDefaultPluginBootstrapService
} from '@modules/plugin/domain/port/plugin/IDefaultPluginBootstrapService';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import PluginStorageService from '@modules/plugin/infrastructure/services/plugin/PluginStorageService';

const DEFAULT_PLUGINS_PATH = path.join(STATIC_ROOT, 'default/plugins');
const DEFAULT_PLUGIN_IMPORT_ORDER = [
    'Polyhedral Template Matching.zip',
    'Adaptive Common Neighbor Analysis.zip',
    'Common Neighbor Analysis.zip',
    'Dislocation Analysis.zip',
    'Elastic Strain.zip'
];

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const sortDefaultPluginZipFiles = (files: string[]): string[] => {
    const order = new Map(DEFAULT_PLUGIN_IMPORT_ORDER.map((file, index) => [file, index]));

    return [...files].sort((left, right) => {
        const leftOrder = order.get(left) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = order.get(right) ?? Number.MAX_SAFE_INTEGER;

        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }

        return left.localeCompare(right);
    });
};

const readModifierKeyFromPluginZip = async (fileBuffer: Buffer): Promise<string> => {
    const directory = await unzipper.Open.buffer(fileBuffer);
    const pluginJsonFile = directory.files.find((file) => file.path === 'plugin.json');
    if (!pluginJsonFile) {
        return '';
    }

    const pluginJsonBuffer = await pluginJsonFile.buffer();
    const manifest = JSON.parse(pluginJsonBuffer.toString('utf-8')) as unknown;
    if (!isRecord(manifest) || !isRecord(manifest.workflow) || !Array.isArray(manifest.workflow.nodes)) {
        return '';
    }

    const modifierNode = manifest.workflow.nodes.find((node) => {
        return isRecord(node) && node.type === 'modifier';
    });
    if (!isRecord(modifierNode) || !isRecord(modifierNode.data) || !isRecord(modifierNode.data.modifier)) {
        return '';
    }

    const modifierKey = modifierNode.data.modifier.key;
    return typeof modifierKey === 'string' ? modifierKey.trim() : '';
};

@Singleton()
export class DefaultPluginBootstrapService implements IDefaultPluginBootstrapService {
    constructor(
        
        private readonly pluginStorageService: PluginStorageService,
        
        private readonly pluginRepository: PluginRepository
    ) {}

    async importDefaultPluginsForTeam(
        teamId: string,
        status: PluginStatus = PluginStatus.Published
    ): Promise<DefaultPluginBootstrapResult> {
        const files = await fs.readdir(DEFAULT_PLUGINS_PATH);
        const zipFiles = sortDefaultPluginZipFiles(files.filter((file) => file.endsWith('.zip')));

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
                const modifierKey = await readModifierKeyFromPluginZip(fileBuffer).catch(() => '');
                if (modifierKey) {
                    const existingPlugin = await this.pluginRepository.findByTeamAndModifierKey(teamId, modifierKey);
                    if (existingPlugin) {
                        logger.info(`@default-plugin-bootstrap: skipped duplicate plugin ${zipFile} key=${modifierKey} for team ${teamId}`);
                        continue;
                    }
                }

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
};
