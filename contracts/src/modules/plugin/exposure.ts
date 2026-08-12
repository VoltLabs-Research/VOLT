import type { IArgumentDefinition, IArgumentVisibilityCondition } from './workflow';

export interface IComputedArgumentOption{
    key: string;
    label: string;
}

export interface IExposureProperty{
    key: string;
    label?: string;
    type?: string;
}

export interface IExposureExport{
    exporter: string;
    type: string;
    options?: Record<string, unknown>;
}

export interface IExposureComputed{
    _id: string;
    id?: string;
    name: string;
    icon?: string;
    results: string;
    hasListing?: boolean;
    properties?: IExposureProperty[];
    export: IExposureExport | null;
    /** Carried through from the workflow node so the run can gate this exposure. */
    exportWhen?: IArgumentVisibilityCondition;
}

export interface IComputedArgumentDefinition extends Omit<IArgumentDefinition, 'options' | 'listArguments'>{
    options?: IComputedArgumentOption[];
    listArguments?: IComputedArgumentDefinition[];
}

export interface IListingExposure{
    exposureId: string;
    name: string;
}

export interface IListingsWithExposures{
    pluginName: string;
    pluginId: string;
    exposures: IListingExposure[];
}
