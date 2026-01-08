import type { IWorkflow, PluginStatus } from "@/types/plugin";

export interface IExposureComputed {
    _id: string;
    name: string;
    icon?: string;
    results: string;
    iterable?: string;
    iterableChunkSize?: number;
    canvas: boolean;
    raster: boolean;
    perAtomProperties: string[];
    listing: Record<string, string> | null;
    listingTitle: string;
    export: {
        exporter: string;
        type: string;
        options?: Record<string, unknown>;
    } | null;
};

export interface IListingExposure {
    name: string;
    slug: string;
    hasPerAtomProperties: boolean;
};

export interface IListingsWithExposures {
    pluginName: string;
    pluginSlug: string;
    exposures: IListingExposure[];
};

export interface IModifierData {
    name: string;
    icon?: string;
    author?: string;
    license?: string;
    version?: string;
    homepage?: string;
    description?: string;
};

export interface IArgumentDefinition {
    argument: string;
    type: string;
    label: string;
    default?: unknown;
    value?: unknown;
    options?: Array<{ key: string; label: string }>;
    min?: number;
    max?: number;
    step?: number;
};

export interface IPluginRecord {
    _id: string;
    slug: string;
    workflow: IWorkflow;
    status: PluginStatus;
    validated: boolean;
    validationErrors: string[];
    createdAt: string;
    updatedAt: string;
    // Computed by backend virtuals:
    modifier?: IModifierData | null;
    exposures?: IExposureComputed[];
    arguments?: IArgumentDefinition[];
    listingsWithExposures?: IListingsWithExposures | null;
};

export interface GetPluginsResponse {
    status: string;
    data: IPluginRecord[];
    page?: { current: number; total: number };
    results?: { skipped: number; total: number; paginated: number };
};

export interface GetPluginResponse {
    status: string;
    data: IPluginRecord;
};

export interface ValidateWorkflowResponse {
    status: string;
    data: {
        valid: boolean;
        errors: string;
    }
};

export interface ExecutePluginResponse {
    status: string;
    data: {
        analysisId: string
    };
};