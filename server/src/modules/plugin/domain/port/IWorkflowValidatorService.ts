import { WorkflowProps } from '@modules/plugin/domain/entities/workflow/Workflow';
import { WorkflowNode } from '@modules/plugin/domain/entities/workflow/WorkflowNode';

export interface WorkflowValidationResult {
    isValid: boolean;
    errors?: string[];
    modifier?: WorkflowNode;
}

export interface IWorkflowValidatorService {
    validate(workflow: WorkflowProps): WorkflowValidationResult;
}
