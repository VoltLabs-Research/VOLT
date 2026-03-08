import type { IWorkflow } from '@/modules/plugin/api/entities/workflow';

export interface SavePluginInputDTO {
    _id?: string;
    workflow: IWorkflow;
};
