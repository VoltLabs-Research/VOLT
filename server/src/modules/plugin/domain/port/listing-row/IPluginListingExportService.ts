import type {
    ListingOptions,
    PluginListingExportResult
} from '@modules/plugin/domain/contracts/listing-row/PluginListing';

export interface IPluginListingExportService {
    exportListingDocuments(pluginId: string, options: ListingOptions): Promise<PluginListingExportResult>;
};
