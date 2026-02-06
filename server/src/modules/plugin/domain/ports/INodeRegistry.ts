import { WorkflowNodeType, WorkflowNode } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import Workflow from '@modules/plugin/domain/entities/workflow/Workflow';

export type SchemaPropertyType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any';

export interface SchemaProperty{
    type: SchemaPropertyType;
    description?: string;
    items?: SchemaProperty;
    properties?: Record<string, SchemaProperty>;
};

export interface NodeOutputSchema{
    properties: Record<string, SchemaProperty>;
};

export const T = {
    string: (description?: string): SchemaProperty => ({ type: 'string', description }),
    number: (description?: string): SchemaProperty => ({ type: 'number', description }),
    boolean: (description?: string): SchemaProperty => ({ type: 'boolean', description }),
    any: (description?: string): SchemaProperty => ({ type: 'any', description }),
    array: (items: SchemaProperty, description?: string): SchemaProperty => ({ type: 'array', items, description }),
    object: (properties: Record<string, SchemaProperty>, description?: string): SchemaProperty => ({ type: 'object', properties, description })
};

export interface ExecutionContext{
    outputs: Map<string, Record<string, any>>;
    userConfig: Record<string, any>;
    trajectoryId: string;
    analysisId: string;
    generatedFiles: string[];
    pluginSlug: string;
    pluginId: string;
    teamId: string;
    selectedFrameOnly?: boolean;
    selectedTimestep?: number;
    workflow: Workflow
};

export interface ValidationResult{
    valid: boolean;
    errors: string[];
};

export interface IWorkflowValidator{
    validateStructure(workflow: Workflow): ValidationResult;
    validateRequiredNodes(workflow: Workflow): ValidationResult;
    validateNodeData(node: WorkflowNode): ValidationResult;
    hasCycle(workflow: Workflow): boolean;
};

export interface INodeHandler<TOutput = Record<string, any>>{
    readonly type: WorkflowNodeType;
    readonly outputSchema: NodeOutputSchema;
    
    execute(
        node: WorkflowNode,
        context: ExecutionContext
    ): Promise<TOutput>;
}

export interface INodeRegistry{
    register(handler: INodeHandler): void;
    get(type: WorkflowNodeType): INodeHandler | undefined;
    execute(node: WorkflowNode, context: ExecutionContext): Promise<Record<string, any>>;
    has(type: WorkflowNodeType): boolean;
    getRegisteredTypes(): WorkflowNodeType[];
    getSchemas(): Record<string, NodeOutputSchema>;

    resolveReference(ref: string, context: ExecutionContext): any;
    resolveTemplate(template: string, context: ExecutionContext): string;
};