import type { JsonObject } from '@shared/contracts/types/json';

export type PluginListingTransferKind = 'listing' | 'sub-listing';

export interface PluginListingTransferExportPayload {
    analysisIds: string[];
    documentType: PluginListingTransferKind;
    skip?: number;
    limit?: number;
}

export interface PluginListingTransferImportPayload {
    analysisIds: string[];
    documentType: PluginListingTransferKind;
    rows: JsonObject[];
}

export interface PluginListingTransferPurgePayload {
    analysisIds: string[];
    documentType: PluginListingTransferKind;
}
