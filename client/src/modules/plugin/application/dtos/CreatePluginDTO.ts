import type { Plugin, IWorkflow, PluginStatus } from '../../domain/entities';

export interface CreatePluginInputDTO {
    workflow: IWorkflow;
    slug?: string;
    status?: PluginStatus;
    team?: string;
};

export type CreatePluginOutputDTO = Plugin;
