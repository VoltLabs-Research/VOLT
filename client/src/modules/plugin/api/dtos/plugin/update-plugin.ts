import type { IWorkflow } from '@/modules/plugin/api/entities/plugin/workflow';
import type { PluginStatus } from '@/modules/plugin/api/entities/plugin/workflow-enums';

export interface UpdatePluginInputDTO {
    _id: string;
    workflow?: IWorkflow;
    status?: PluginStatus;
};
