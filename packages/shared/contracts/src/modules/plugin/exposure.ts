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

export type PanelColumnFormat = 'integer' | 'decimal' | 'percent';

export interface IPanelColumn{
    column: string;
    label: string;
    format?: PanelColumnFormat;
}

export interface IPanelTable{
    source: string;
    title: string;
    label: string;
    columns: IPanelColumn[];
    colorBy?: string;
    colors?: Record<string, [number, number, number, number]>;
}

export interface IExposurePanel{
    tables: IPanelTable[];
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
    exportWhen?: IArgumentVisibilityCondition;
    panel?: IExposurePanel;
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
