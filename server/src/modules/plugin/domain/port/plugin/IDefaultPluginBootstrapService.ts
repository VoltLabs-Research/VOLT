import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';

export interface DefaultPluginBootstrapResult {
    totalFound: number;
    importedCount: number;
    failedPlugins: string[];
};

export interface IDefaultPluginBootstrapService {
    importDefaultPluginsForTeam(teamId: string, status: PluginStatus): Promise<DefaultPluginBootstrapResult>;
};
