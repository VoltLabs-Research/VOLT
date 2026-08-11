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
        subListingNames: string[];
    };
}

export interface ReplaceSubListingRowsInput {
    analysis: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
    /**
     * Rows in batches rather than one array: a single sub-listing can describe tens of
     * millions of entries, so neither the reader that produces them nor the write below
     * may hold them all at once.
     */
    rowBatches: AsyncIterable<PluginListingTransferRow[]>;
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
