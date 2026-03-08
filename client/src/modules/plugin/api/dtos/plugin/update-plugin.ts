import type { IWorkflow } from '@/modules/plugin/api/entities/workflow';
import type { PluginStatus } from '@/modules/plugin/api/entities/workflow-enums';

export interface UpdatePluginInputDTO {
    _id: string;
    workflow?: IWorkflow;
    status?: PluginStatus;
};
