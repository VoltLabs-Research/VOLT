import type { ArgumentType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { IArgumentVisibilityCondition } from '@/modules/plugin/api/entities/plugin/workflow';

export interface IComputedArgumentOption {
    key: string;
    label: string;
};

export interface IExposureComputed {
    _id: string;
    name: string;
    icon?: string;
    results: string;
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
    required?: boolean;
    multipleSelection?: boolean;
    pluginReferenceFilter?: string[];
    pluginReferenceFilterKeys?: string[];
    showPluginConfiguration?: boolean;
    min?: number;
    max?: number;
    step?: number;
    visibleWhen?: IArgumentVisibilityCondition;
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
