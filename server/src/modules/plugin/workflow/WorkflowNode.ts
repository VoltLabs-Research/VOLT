import { WorkflowNodeData } from './WorkflowNodeData';
import { WorkflowNodeType } from '@shared/contracts/types/Plugin';

export { WorkflowNodeType };

export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    position: {
        x: number;
        y: number;
    };
    data: WorkflowNodeData;
}
