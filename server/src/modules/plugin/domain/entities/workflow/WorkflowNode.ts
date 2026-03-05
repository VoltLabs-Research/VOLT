import { WorkflowNodeData } from './WorkflowNodeData';

export enum WorkflowNodeType {
    Modifier = 'modifier',
    Arguments = 'arguments',
    Context = 'context',
    ForEach = 'forEach',
    Entrypoint = 'entrypoint',
    Exposure = 'exposure',
    Export = 'export',
    IfStatement = 'if-statement'
};

export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    position: {
        x: number;
        y: number;
    };
    data: WorkflowNodeData;
};