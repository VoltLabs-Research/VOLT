
import type { PluginRecord } from '@shared/contracts/operations/PluginRecord';
import type { PluginProps, WorkflowPropsLike } from '@shared/contracts/types/Plugin';

export interface GetPluginByIdInput {
    pluginId: string;
}

export type GetPluginByIdOutput = PluginRecord<PluginProps, WorkflowPropsLike>;
