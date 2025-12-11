import type { NodeTypes } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import ModifierNode from './ModifierNode';
import ArgumentsNode from './ArgumentsNode';
import ContextNode from './ContextNode';
import ForEachNode from './ForEachNode';
import EntrypointNode from './EntrypointNode';
import ExposureNode from './ExposureNode';

export const nodeTypes: NodeTypes = {
    [NodeType.MODIFIER]: ModifierNode,
    [NodeType.ARGUMENTS]: ArgumentsNode,
    [NodeType.CONTEXT]: ContextNode,
    [NodeType.FOREACH]: ForEachNode,
    [NodeType.ENTRYPOINT]: EntrypointNode,
    [NodeType.EXPOSURE]: ExposureNode
};

export {
    ModifierNode,
    ArgumentsNode,
    ContextNode,
    ForEachNode,
    EntrypointNode,
    ExposureNode
};