// Payloads and results of the plugin commands in DaemonCommand.

export interface PluginSyncRequest{
    pluginId: string;
    objectKey: string;
    ownerClusterId: string;
    expectedHash?: string;
}

export interface PluginSyncResult{
    synced: boolean;
    objectKey: string;
}

export interface PluginWarmupRequest{
    pluginId: string;
    binaryObjectPath: string;
    ownerClusterId?: string;
    requirementsFile: string;
    entrypointScript?: string;
    expectedHash?: string;
}

export interface PluginWarmupResult{
    queued: boolean;
    jobId: string;
}

export interface PluginRegistryInstallRequest{
    downloadUrl: string;
    sha256: string;
    fileName: string;
    name: string;
    version: string;
    platform: string;
}

export interface PluginRegistryInstallBinary{
    objectPath: string;
    fileName: string;
    hash: string;
    sizeBytes: number;
}

export interface PluginRegistryInstallResult{
    // The workflow packaged with the plugin, validated by the server before it is stored.
    workflow: unknown;
    binary: PluginRegistryInstallBinary;
    ownerClusterId: string;
}

export type PluginListingTransferKind = 'listing' | 'sub-listing';

interface PluginListingTransferScope{
    analysisIds: string[];
    documentType: PluginListingTransferKind;
}

export interface PluginListingTransferExportRequest extends PluginListingTransferScope{
    skip?: number;
    limit?: number;
}

export interface PluginListingTransferExportResult{
    rows: Record<string, unknown>[];
    total: number;
    hasMore: boolean;
    nextSkip: number;
}

export interface PluginListingTransferImportRequest extends PluginListingTransferScope{
    rows: Record<string, unknown>[];
}

export interface PluginListingTransferImportResult{
    importedRows: number;
}

export type PluginListingTransferPurgeRequest = PluginListingTransferScope;

export interface PluginListingTransferPurgeResult{
    deletedRows: number;
}
