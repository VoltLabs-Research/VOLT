import { WorkflowProps } from '@modules/plugin/entities/plugin/workflow/Workflow';
import { WorkflowNode } from '@modules/plugin/entities/plugin/workflow/WorkflowNode';

export interface ValidateWorkflowInputDTO {
    workflow: WorkflowProps;
    pluginId?: string;
}

export interface ValidateWorkflowOutputDTO {
    validated: boolean;
    errors?: string[];
    modifier?: WorkflowNode;
}
