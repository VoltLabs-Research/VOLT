import type { PluginRecord as PluginRecordContract } from '@shared/contracts/operations/PluginRecord';
import type { Plugin, PluginProps } from '@modules/plugin/models/plugin/PluginModel';
import type { WorkflowProps } from '@modules/plugin/workflow/Workflow';
import { mapPluginToRecord as mapPluginToRecordNeutral } from '@shared/application/utilities/mapPluginToRecord';

export type PluginRecord = PluginRecordContract<PluginProps, WorkflowProps>;

export const mapPluginToRecord = (plugin: Plugin): PluginRecord =>
    mapPluginToRecordNeutral(plugin) as PluginRecord;
