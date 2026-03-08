import type { IWorkflow } from '@/modules/plugin/api/entities/plugin/workflow';

export interface SavePluginInputDTO {
    _id?: string;
    workflow: IWorkflow;
};
