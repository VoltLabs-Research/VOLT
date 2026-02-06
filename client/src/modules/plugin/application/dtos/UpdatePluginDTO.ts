import type { Plugin, IWorkflow, PluginStatus } from '../../domain/entities';

export interface UpdatePluginInputDTO {
    id: string;
    workflow?: IWorkflow;
    slug?: string;
    status?: PluginStatus;
};

export type UpdatePluginOutputDTO = Plugin;
