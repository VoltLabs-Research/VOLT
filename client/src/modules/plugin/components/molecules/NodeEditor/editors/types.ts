import type { Node } from '@xyflow/react';
import type { INodeData } from '@/modules/plugin/api/entities/workflow';

export interface EditorProps {
    node: Node<INodeData>;
};
