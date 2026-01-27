import type { NodeTypes } from '@xyflow/react';
import { NodeType } from '@/modules/plugins/domain/entities';
import ModifierNode from './ModifierNode';
import ArgumentsNode from './ArgumentsNode';
import ContextNode from './ContextNode';
import ForEachNode from './ForEachNode';
import EntrypointNode from './EntrypointNode';
import ExposureNode from './ExposureNode';
import SchemaNode from './SchemaNode';
import VisualizersNode from './VisualizersNode';
import ExportNode from './ExportNode';
import IfStatementNode from './IfStatementNode';

export const nodeTypes: NodeTypes = {
    [NodeType.MODIFIER]: ModifierNode,
    [NodeType.ARGUMENTS]: ArgumentsNode,
    [NodeType.CONTEXT]: ContextNode,
    [NodeType.FOREACH]: ForEachNode,
    [NodeType.ENTRYPOINT]: EntrypointNode,
    [NodeType.EXPOSURE]: ExposureNode,
    [NodeType.SCHEMA]: SchemaNode,
    [NodeType.VISUALIZERS]: VisualizersNode,
    [NodeType.EXPORT]: ExportNode,
    [NodeType.IF_STATEMENT]: IfStatementNode
};

export {
    ModifierNode,
    ArgumentsNode,
    ContextNode,
    ForEachNode,
    EntrypointNode,
    ExposureNode,
    SchemaNode,
    VisualizersNode,
    ExportNode,
    IfStatementNode
};
