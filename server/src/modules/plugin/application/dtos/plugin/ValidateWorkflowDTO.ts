import { WorkflowProps } from '@modules/plugin/domain/entities/workflow/Workflow';
import { WorkflowNode } from '@modules/plugin/domain/entities/workflow/WorkflowNode';

export interface ValidateWorkflowInputDTO {
    workflow: WorkflowProps;
}

export interface ValidateWorkflowOutputDTO {
    validated: boolean;
    errors?: string[];
    modifier?: WorkflowNode;
}
