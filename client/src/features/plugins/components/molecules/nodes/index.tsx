import type { NodeTypes } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import ModifierNode from '@/features/plugins/components/molecules/nodes/ModifierNode';
import ArgumentsNode from '@/features/plugins/components/molecules/nodes/ArgumentsNode';
import ContextNode from '@/features/plugins/components/molecules/nodes/ContextNode';
import ForEachNode from '@/features/plugins/components/molecules/nodes/ForEachNode';
import EntrypointNode from '@/features/plugins/components/molecules/nodes/EntrypointNode';
import ExposureNode from '@/features/plugins/components/molecules/nodes/ExposureNode';
import SchemaNode from '@/features/plugins/components/molecules/nodes/SchemaNode';
import VisualizersNode from '@/features/plugins/components/molecules/nodes/VisualizersNode';
import ExportNode from '@/features/plugins/components/molecules/nodes/ExportNode';
import IfStatementNode from '@/features/plugins/components/molecules/nodes/IfStatementNode';

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

