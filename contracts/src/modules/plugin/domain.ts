// Wire response types for the plugin module — the shapes the client reads back
// from `data`. `_id`, refs and dates are strings on the wire. The workflow graph
// is intentionally loose (nodes/edges are open records) because its node-data
// union is a large server-owned domain type the client treats structurally.

export interface WorkflowViewportWire{
    x: number;
    y: number;
    zoom: number;
}

export interface WorkflowWire{
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
    viewport?: WorkflowViewportWire;
}

/** A plugin as the client sees it (the persisted-plugin DTO shape on the wire). */
export interface PersistedPlugin{
    _id: string;
    team: string;
    status: string;
    workflow: WorkflowWire;
    modifier?: Record<string, unknown> | null;
    exposures?: Array<Record<string, unknown>>;
    arguments?: Array<Record<string, unknown>>;
    listingExposures?: Array<Record<string, unknown>>;
    createdAt: string;
    updatedAt: string;
    [key: string]: unknown;
}

export interface CreatePluginResponse{
    plugin: PersistedPlugin;
}

export type GetPluginResponse = PersistedPlugin;
export type UpdatePluginResponse = PersistedPlugin;
export type ClonePluginResponse = { plugin: PersistedPlugin };
export type InstallRegistryPluginResponse = PersistedPlugin;
export type ImportPluginResponse = PersistedPlugin;

export interface GetNodeTypesSchemaResponse{
    nodeTypes: Record<string, string[]>;
}

export interface ValidateWorkflowResponse{
    validated: boolean;
    errors?: string[];
    modifier?: Record<string, unknown>;
}

/** Registry search hit + envelope. */
export interface RegistryPackageSummary{
    fullName: string;
    name: string;
    username: string;
    kind: string;
    description?: string;
    keywords?: string[];
    latest?: string;
    downloads?: { total: number; last30d: number };
    updatedAt?: string;
}

export interface SearchRegistryResponse{
    items: RegistryPackageSummary[];
    page: number;
    pageSize: number;
    total: number;
}

export interface BinaryUploadResult{
    objectPath: string;
    fileName: string;
    size: number;
    binaryHash: string;
}

export interface BinaryUploadTarget extends BinaryUploadResult{
    uploadUrl: string;
    expiresAt: string;
}

export interface ExecutePipelineResponse{
    analysisIds: string[];
}

// ---- listing-row responses -------------------------------------------------

export interface ListingColumnDef{
    key?: string;
    label: string;
    title?: string;
    sortable: boolean;
    width?: number;
}

export interface ListingRowData{
    _id: string;
    timestep: number;
    analysisId: string;
    trajectoryId: string;
    exposureId: string;
    trajectoryName: string;
    [key: string]: unknown;
}

export interface ListingRowByAnalysisData{
    _id: string;
    plugin: string;
    exposureId: string;
    exposureName: string;
    trajectory: string;
    trajectoryName: string;
    timestep: number;
    row: Record<string, unknown>;
}

export interface SubListingColumn{
    label: string;
    sortable: boolean;
}

export interface SubListingRowData{
    _id: string;
    [key: string]: unknown;
}

export interface AnalysisListingExportOption{
    id: string;
    listingId: string;
    listingName: string;
    label: string;
}

export interface AnalysisSubListingExportOption{
    id: string;
    exposureId: string;
    exposureName: string;
    timestep: number;
    subListingName: string;
    label: string;
}

export interface GetAnalysisListingExportOptionsResponse{
    analysisId: string;
    hasConfig: boolean;
    listings: AnalysisListingExportOption[];
    subListings: AnalysisSubListingExportOption[];
}
