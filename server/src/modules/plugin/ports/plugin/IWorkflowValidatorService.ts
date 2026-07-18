import { WorkflowProps } from '@modules/plugin/entities/plugin/workflow/Workflow';
import { WorkflowNode } from '@modules/plugin/entities/plugin/workflow/WorkflowNode';

export interface WorkflowValidationPluginReference {
    nodeId: string;
    pluginId: string;
}

export enum WorkflowValidationMode {
    Draft = 'draft',
    Strict = 'strict'
}

export interface WorkflowValidationResult {
    isValid: boolean;
    errors?: string[];
    modifier?: WorkflowNode;
    pluginReferences?: WorkflowValidationPluginReference[];
}

export interface IWorkflowValidatorService {
    validate(
        workflow: WorkflowProps,
        currentPluginId?: string,
        mode?: WorkflowValidationMode
    ): Promise<WorkflowValidationResult>;
}
