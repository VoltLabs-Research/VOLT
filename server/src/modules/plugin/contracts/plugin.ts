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
    /**
     * Gates the exposure on one of the plugin's arguments. Kept on the persisted props
     * because the analysis planner needs it before any daemon is involved, to decide which
     * artifacts a run is even expected to produce.
     */
    exportWhen?: ArgumentVisibilityCondition;
    /** Declared results tables for the analysis panel; passed through untouched. */
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
