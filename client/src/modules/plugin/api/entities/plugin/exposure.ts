import type {
    IArgumentDefinition
} from '@/modules/plugin/api/entities/plugin/workflow';

export interface IComputedArgumentOption {
    key: string;
    label: string;
}

export interface IExposureComputed {
    _id: string;
    name: string;
    icon?: string;
    results: string;
    hasListing?: boolean;
    export: IExposureExport | null;
}

export interface IExposureExport {
    exporter: string;
    type: string;
    options?: Record<string, unknown>;
}

export interface IComputedArgumentDefinition extends Omit<IArgumentDefinition, 'options' | 'listArguments'> {
    options?: IComputedArgumentOption[];
    listArguments?: IComputedArgumentDefinition[];
}

export interface IListingExposure {
    exposureId: string;
    name: string;
}

export interface IListingsWithExposures {
    pluginName: string;
    pluginId: string;
    exposures: IListingExposure[];
}
