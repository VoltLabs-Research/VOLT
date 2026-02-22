import { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { IWorkflow, IModifierData, PluginStatus } from './Workflow';
import type { IExposureComputed, IComputedArgumentDefinition, IListingsWithExposures } from './Exposure';

export interface Plugin extends BaseEntity {
    workflow: IWorkflow;
    status: PluginStatus;
    validated: boolean;
    validationErrors: string[];
    modifier?: IModifierData | null;
    exposures?: IExposureComputed[];
    arguments?: IComputedArgumentDefinition[];
    listingExposures?: IListingsWithExposures | null;
};
