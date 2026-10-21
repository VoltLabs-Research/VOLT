import type Workflow from '@modules/plugin/models/plugin/workflow/Workflow';
import type { PluginProjection } from '@modules/plugin/services/plugin/WorkflowProjection';
import type { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import type { PluginRecord as PluginRecordContract } from '@shared/contracts/operations/PluginRecord';
import type { IArgumentVisibilityCondition, IExportData, IWorkflow } from '@volt/contracts/modules/plugin/workflow';
import type { IExposurePanel, IExposureProperty } from '@volt/contracts/modules/plugin/exposure';

export interface PluginExposureProps{
    _id: string;
    id?: string;
    name: string;
    results: string;
    icon?: string;
    hasListing: boolean;
    properties: IExposureProperty[];
    export: IExportData | null;
    exportWhen?: IArgumentVisibilityCondition;
    panel?: IExposurePanel;
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

export type PluginRecord = PluginRecordContract<PluginProps, IWorkflow>;
