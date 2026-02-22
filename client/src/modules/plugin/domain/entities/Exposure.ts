import type { ArgumentType } from './Workflow';

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
    export: IExposureExport | null;
};

export interface IExposureExport {
    exporter: string;
    type: string;
    options?: Record<string, unknown>;
};

export interface IComputedArgumentDefinition {
    argument: string;
    type: ArgumentType;
    label: string;
    default?: unknown;
    value?: unknown;
    options?: Array<{ key: string; label: string }>;
    min?: number;
    max?: number;
    step?: number;
};

export interface IListingExposure {
    exposureId: string;
    name: string;
    exposureName: string;
    hasPerAtomProperties: boolean;
};

export interface IListingsWithExposures {
    pluginName: string;
    pluginId: string;
    exposures: IListingExposure[];
};
