import type { BaseEntity } from '@/shared/types/BaseEntity';
import type { IWorkflow, IModifierData } from '@/modules/plugin/api/types/plugin/workflow';
import type { PluginStatus } from '@/modules/plugin/api/types/plugin/workflow-enums';
import type {
    IExposureComputed,
    IComputedArgumentDefinition,
    IListingsWithExposures
} from '@/modules/plugin/api/types/plugin/exposure';

export interface Plugin extends BaseEntity {
    teamCluster?: string | null;
    workflow: IWorkflow;
    status: PluginStatus;
    modifier?: IModifierData | null;
    exposures?: IExposureComputed[];
    arguments?: IComputedArgumentDefinition[];
    listingExposures?: IListingsWithExposures | null;
}
