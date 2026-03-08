import type {
    ListingOptions,
    PluginListingPaginatedResult
} from '@modules/plugin/domain/contracts/listing-row/PluginListing';

export interface IPluginListingService {
    getListingDocuments(pluginId: string, options: ListingOptions): Promise<PluginListingPaginatedResult>;
};
