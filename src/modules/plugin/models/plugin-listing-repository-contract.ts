import type { PaginatedResult } from '@shared/contracts/types/pagination';
import type { PluginListingRowDocument } from '@modules/plugin/models/plugin-listing-row-model';
import type { JsonObject } from '@shared/contracts/types/json';

export type PluginListingTransferRow = JsonObject;

export interface PluginListingFilter {
    pluginId?: string;
    trajectoryId?: string;
    analysisId?: string;
    exposureId?: string;
    exposureName?: string;
    page: number;
    limit: number;
}

export interface PluginSubListingFilter {
    analysisId?: string;
    exposureId?: string;
    timestep?: number;
    subListingName?: string;
    page: number;
    limit: number;
}

export interface BulkUpsertOperation {
    filter: {
        analysis: string;
        exposureId: string;
        timestep: number;
    };
    update: {
        plugin: string;
        team: string;
        trajectory: string;
        analysis: string;
        exposureName: string;
        exposureId: string;
        timestep: number;
        row: PluginListingTransferRow;
        propertyObjectKey?: string;
        propertyOwnerClusterId?: string;
        subListingNames: string[];
    };
}

export interface ReplaceSubListingRowsInput {
    analysis: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
    rows: PluginListingTransferRow[];
}

export interface ListingPaginatedResult extends PaginatedResult<PluginListingRowDocument> {
    columns: string[];
    subListingNames: string[];
}

export interface PluginListingTransferExportResult {
    rows: PluginListingTransferRow[];
    total: number;
    hasMore: boolean;
    nextSkip: number;
}
