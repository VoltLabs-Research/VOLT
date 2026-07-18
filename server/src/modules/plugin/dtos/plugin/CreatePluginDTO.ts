import { WorkflowProps } from '@modules/plugin/entities/plugin/workflow/Workflow';

import type { PersistedPluginDTO } from '@modules/plugin/dtos/plugin/PersistedPluginDTO';

export interface CreatePluginInputDTO {
    workflow: WorkflowProps;
    teamId: string;
}

export interface CreatePluginOutputDTO {
    plugin: PersistedPluginDTO;
}
