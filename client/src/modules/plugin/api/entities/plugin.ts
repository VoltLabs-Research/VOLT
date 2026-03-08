import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { IWorkflow, IModifierData } from '@/modules/plugin/api/entities/workflow';
import type { PluginStatus } from '@/modules/plugin/api/entities/workflow-enums';
import type {
    IExposureComputed,
    IComputedArgumentDefinition,
    IListingsWithExposures
} from '@/modules/plugin/api/entities/exposure';

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
