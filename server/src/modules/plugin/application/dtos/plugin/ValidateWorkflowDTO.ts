import { WorkflowProps } from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import { WorkflowNode } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';

export interface ValidateWorkflowInputDTO {
    workflow: WorkflowProps;
};

export interface ValidateWorkflowOutputDTO {
    validated: boolean;
    errors?: string[];
    modifier?: WorkflowNode;
};
