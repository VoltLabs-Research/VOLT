import type {
    ArgumentVisibilityCondition,
    ExportNodeData,
    ExposurePanel,
    ExposureProperty
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import type Workflow from '@modules/plugin/models/plugin/workflow/Workflow';
import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import type { PluginProjection } from '@modules/plugin/services/plugin/WorkflowProjection';
import type { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import type { PluginRecord as PluginRecordContract } from '@shared/contracts/operations/PluginRecord';

export interface PluginExposureProps{
    _id: string;
    id?: string;
    name: string;
    results: string;
    icon?: string;
    hasListing: boolean;
    properties: ExposureProperty[];
    export: ExportNodeData | null;
    exportWhen?: ArgumentVisibilityCondition;
    panel?: ExposurePanel;
}

export interface PluginProps extends Partial<PluginProjection>{
    team: string;
    workflow: Workflow;
    status: PluginStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface Plugin{
    readonly _id: string;
    readonly id: string;
    props: PluginProps;
}

export type PluginRecord = PluginRecordContract<PluginProps, WorkflowProps>;
