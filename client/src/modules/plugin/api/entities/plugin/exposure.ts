import type { ArgumentType } from '@/modules/plugin/api/entities/plugin/workflow-enums';

export interface IComputedArgumentOption {
    key: string;
    label: string;
};

export interface IExposureComputed {
    _id: string;
    name: string;
    icon?: string;
    results: string;
    iterable?: string;
    iterableChunkSize?: number;
    canvas: boolean;
    raster: boolean;
    hasListing: boolean;
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
    options?: IComputedArgumentOption[];
    listArguments?: IComputedArgumentDefinition[];
    min?: number;
    max?: number;
    step?: number;
};

export interface IListingExposure {
    exposureId: string;
    name: string;
};

export interface IListingsWithExposures {
    pluginName: string;
    pluginId: string;
    exposures: IListingExposure[];
};
