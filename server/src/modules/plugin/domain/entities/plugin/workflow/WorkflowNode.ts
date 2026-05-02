import { WorkflowNodeData } from './WorkflowNodeData';

export enum WorkflowNodeType {
    Modifier = 'modifier',
    Arguments = 'arguments',
    Context = 'context',
    ForEach = 'forEach',
    Entrypoint = 'entrypoint',
    Plugin = 'plugin-node',
    Exposure = 'exposure',
    Export = 'export',
    IfStatement = 'if-statement',
    SwitchStatement = 'switch-statement',
    SwitchCase = 'switch-case'
}

export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    position: {
        x: number;
        y: number;
    };
    data: WorkflowNodeData;
}
