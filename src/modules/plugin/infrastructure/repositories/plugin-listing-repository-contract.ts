import type { PaginatedResult } from '@/support/contracts/pagination';
import type { PluginListingRowDocument } from '@/modules/plugin/domain/models/plugin-listing-row-model';
import type { PluginSubListingRowDocument } from '@/modules/plugin/domain/models/plugin-sub-listing-row-model';
import type { JsonObject, JsonValue } from '@/support/types/json';

export type PluginMongoValue = JsonValue;
export type PluginMongoRow = JsonObject;

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
        row: PluginMongoRow;
        payloadObjectKey: string;
        payloadOwnerClusterId: string;
        subListingNames: string[];
    };
}

export interface ListingPaginatedResult extends PaginatedResult<PluginListingRowDocument> {
    columns: string[];
    subListingNames: string[];
}

export type PluginDocumentType = 'listing' | 'sub-listing';

interface PluginMongoScopedInput {
    documentType: PluginDocumentType;
}

interface PluginMongoAnalysisScopedInput extends PluginMongoScopedInput {
    analysisIds: string[];
}

export type PluginMongoRowsExportInput = PluginMongoAnalysisScopedInput & {
    skip?: number;
    limit?: number;
};

export interface PluginMongoRowsExportResult {
    rows: PluginMongoRow[];
    total: number;
    hasMore: boolean;
    nextSkip: number;
}

export type PluginMongoRowsImportInput = PluginMongoScopedInput & {
    rows: PluginMongoRow[];
};

export type PluginMongoRowsPurgeInput = PluginMongoAnalysisScopedInput;

export interface PluginListingRepository {
    listPluginListings(filter: PluginListingFilter): Promise<ListingPaginatedResult>;
    listPluginSubListings(filter: PluginSubListingFilter): Promise<PaginatedResult<PluginSubListingRowDocument>>;
    bulkUpsertListingRows(operations: BulkUpsertOperation[]): Promise<void>;
    exportMongoRows(input: PluginMongoRowsExportInput): Promise<PluginMongoRowsExportResult>;
    importMongoRows(input: PluginMongoRowsImportInput): Promise<number>;
    purgeMongoRows(input: PluginMongoRowsPurgeInput): Promise<number>;
}
