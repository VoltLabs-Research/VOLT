import type { PluginProps } from '@modules/plugin/domain/entities/Plugin';
import type { WorkflowProps } from '@modules/plugin/domain/entities/workflow/Workflow';

export interface PersistedPluginDTO extends Omit<PluginProps, 'workflow'> {
    _id: string;
    workflow: WorkflowProps;
}
