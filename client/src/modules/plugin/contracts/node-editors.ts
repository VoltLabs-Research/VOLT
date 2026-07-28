import type { Node } from '@xyflow/react';
import type { INodeData } from '@volt/contracts/modules/plugin/domain/workflow';

export interface EditorProps {
    node: Node<INodeData>;
}
