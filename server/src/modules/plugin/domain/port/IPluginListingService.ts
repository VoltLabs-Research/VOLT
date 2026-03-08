import type {
    ListingOptions,
    PluginListingPaginatedResult
} from '@modules/plugin/domain/port/PluginListingTypes';

export interface IPluginListingService {
    getListingDocuments(pluginId: string, options: ListingOptions): Promise<PluginListingPaginatedResult>;
}
