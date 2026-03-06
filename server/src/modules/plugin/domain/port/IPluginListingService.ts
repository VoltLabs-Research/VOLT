import { PluginListingPaginatedResult } from '@modules/plugin/infrastructure/services/PluginListingService';

export interface IPluginListingService {
    getListingDocuments(pluginId: string, options: any): Promise<PluginListingPaginatedResult>;
}
