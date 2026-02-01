import type { NodeTypes } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/domain/entities';
import ModifierNode from '@/modules/plugin/presentation/components/molecules/nodes/ModifierNode';
import ArgumentsNode from '@/modules/plugin/presentation/components/molecules/nodes/ArgumentsNode';
import ContextNode from '@/modules/plugin/presentation/components/molecules/nodes/ContextNode';
import ForEachNode from '@/modules/plugin/presentation/components/molecules/nodes/ForEachNode';
import EntrypointNode from '@/modules/plugin/presentation/components/molecules/nodes/EntrypointNode';
import ExposureNode from '@/modules/plugin/presentation/components/molecules/nodes/ExposureNode';
import SchemaNode from '@/modules/plugin/presentation/components/molecules/nodes/SchemaNode';
import VisualizersNode from '@/modules/plugin/presentation/components/molecules/nodes/VisualizersNode';
import ExportNode from '@/modules/plugin/presentation/components/molecules/nodes/ExportNode';
import IfStatementNode from '@/modules/plugin/presentation/components/molecules/nodes/IfStatementNode';

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
