import type { IWorkflow, IModifierData, PluginStatus } from './Workflow';
import type { IExposureComputed, IComputedArgumentDefinition, IListingsWithExposures } from './Exposure';

export interface Plugin {
    _id: string;
    slug: string;
    workflow: IWorkflow;
    status: PluginStatus;
    validated: boolean;
    validationErrors: string[];
    createdAt: string;
    updatedAt: string;
    modifier?: IModifierData | null;
    exposures?: IExposureComputed[];
    arguments?: IComputedArgumentDefinition[];
    listingsWithExposures?: IListingsWithExposures | null;
};
