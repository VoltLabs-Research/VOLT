import type { JsonObject } from '@/support/types/json';

export type TeamClusterDaemonPluginMongoDocumentType = 'listing' | 'sub-listing';

export interface TeamClusterDaemonPluginMongoExportPayload {
    analysisIds: string[];
    documentType: TeamClusterDaemonPluginMongoDocumentType;
    skip?: number;
    limit?: number;
}

export interface TeamClusterDaemonPluginMongoExportResult {
    rows: JsonObject[];
    total: number;
    hasMore: boolean;
    nextSkip: number;
}

export interface TeamClusterDaemonPluginMongoImportPayload {
    analysisIds: string[];
    documentType: TeamClusterDaemonPluginMongoDocumentType;
    rows: JsonObject[];
}

export interface TeamClusterDaemonPluginMongoImportResult {
    importedRows: number;
}

export interface TeamClusterDaemonPluginMongoPurgePayload {
    analysisIds: string[];
    documentType: TeamClusterDaemonPluginMongoDocumentType;
}

export interface TeamClusterDaemonPluginMongoPurgeResult {
    deletedRows: number;
}
