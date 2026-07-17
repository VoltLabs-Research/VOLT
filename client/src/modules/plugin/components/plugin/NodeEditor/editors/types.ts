import type { Node } from '@xyflow/react';
import type { INodeData } from '@/modules/plugin/api/types/plugin/workflow';

export interface EditorProps {
    node: Node<INodeData>;
}
