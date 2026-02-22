import type { Plugin, IWorkflow, PluginStatus } from '../../domain/entities';

export interface UpdatePluginInputDTO {
    id: string;
    workflow?: IWorkflow;
    status?: PluginStatus;
};

export type UpdatePluginOutputDTO = Plugin;
