import type {
    ListingOptions,
    PluginListingExportResult
} from '@modules/plugin/domain/port/PluginListingTypes';

export interface IPluginListingExportService {
    exportListingDocuments(pluginId: string, options: ListingOptions): Promise<PluginListingExportResult>;
}
