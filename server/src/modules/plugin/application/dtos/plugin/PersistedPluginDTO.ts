import type { PluginProps } from '@modules/plugin/domain/entities/plugin/Plugin';
import type { WorkflowProps } from '@modules/plugin/domain/entities/plugin/workflow/Workflow';

export interface PersistedPluginDTO extends Omit<PluginProps, 'workflow'> {
    _id: string;
    workflow: WorkflowProps;
};
