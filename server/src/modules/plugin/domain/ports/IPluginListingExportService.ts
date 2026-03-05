import { PluginListingExportResult } from '@modules/plugin/infrastructure/services/PluginListingService';

export interface IPluginListingExportService {
    exportListingDocuments(pluginId: string, options: any): Promise<PluginListingExportResult>;
}
