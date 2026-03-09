import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { IWorkflow, IModifierData } from '@/modules/plugin/api/entities/plugin/workflow';
import type { PluginStatus } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type {
    IExposureComputed,
    IComputedArgumentDefinition,
    IListingsWithExposures
} from '@/modules/plugin/api/entities/plugin/exposure';

export interface Plugin extends BaseEntity {
    teamCluster?: string | null;
    workflow: IWorkflow;
    status: PluginStatus;
    modifier?: IModifierData | null;
    exposures?: IExposureComputed[];
    arguments?: IComputedArgumentDefinition[];
    listingExposures?: IListingsWithExposures | null;
};
