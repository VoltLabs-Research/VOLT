import type { PaginatedResult } from '@/support/contracts/pagination';
import type { PluginListingRowDocument } from '@/modules/plugin/domain/models/plugin-listing-row-model';
import type { PluginSubListingRowDocument } from '@/modules/plugin/domain/models/plugin-sub-listing-row-model';

interface PluginMongoObject {
    [key: string]: PluginMongoValue;
}

export type PluginMongoValue = null | boolean | number | string | PluginMongoValue[] | PluginMongoObject;

export interface PluginMongoRow {
    [key: string]: PluginMongoValue;
}

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

export interface PluginMongoRowsExportInput {
    analysisIds: string[];
    documentType: 'listing' | 'sub-listing';
    skip?: number;
    limit?: number;
}

export interface PluginMongoRowsExportResult {
    rows: PluginMongoRow[];
    total: number;
    hasMore: boolean;
    nextSkip: number;
}

export interface PluginMongoRowsImportInput {
    rows: PluginMongoRow[];
    documentType: 'listing' | 'sub-listing';
}

export interface PluginMongoRowsPurgeInput {
    analysisIds: string[];
    documentType: 'listing' | 'sub-listing';
}

export interface PluginListingRepository {
    listPluginListings(filter: PluginListingFilter): Promise<ListingPaginatedResult>;
    listPluginSubListings(filter: PluginSubListingFilter): Promise<PaginatedResult<PluginSubListingRowDocument>>;
    bulkUpsertListingRows(operations: BulkUpsertOperation[]): Promise<void>;
    exportMongoRows(input: PluginMongoRowsExportInput): Promise<PluginMongoRowsExportResult>;
    importMongoRows(input: PluginMongoRowsImportInput): Promise<number>;
    purgeMongoRows(input: PluginMongoRowsPurgeInput): Promise<number>;
}
