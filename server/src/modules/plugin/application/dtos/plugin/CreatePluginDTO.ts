import { WorkflowProps } from '@modules/plugin/domain/entities/plugin/workflow/Workflow';

import type { PersistedPluginDTO } from '@modules/plugin/application/dtos/plugin/PersistedPluginDTO';

export interface CreatePluginInputDTO {
    workflow: WorkflowProps;
    teamId: string;
};

export interface CreatePluginOutputDTO {
    plugin: PersistedPluginDTO;
};
