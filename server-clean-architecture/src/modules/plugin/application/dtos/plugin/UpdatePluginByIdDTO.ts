import { PluginProps, PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import { WorkflowProps } from '@modules/plugin/domain/entities/workflow/Workflow';

export interface UpdatePluginByIdInputDTO {
    pluginId: string;
    workflow?: WorkflowProps;
    status?: PluginStatus;
}

export interface UpdatePluginByIdOutputDTO extends PluginProps{}