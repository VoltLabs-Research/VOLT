import type { NodeTypes } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import ModifierNode from './ModifierNode';
import ArgumentsNode from './ArgumentsNode';
import ContextNode from './ContextNode';
import ForEachNode from './ForEachNode';
import EntrypointNode from './EntrypointNode';
import PluginNode from './PluginNode';
import ExposureNode from './ExposureNode';
import ExportNode from './ExportNode';
import IfStatementNode from './IfStatementNode';
import SwitchStatementNode from './SwitchStatementNode';
import SwitchCaseNode from './SwitchCaseNode';

export const nodeTypes: NodeTypes = {
    [NodeType.MODIFIER]: ModifierNode,
    [NodeType.ARGUMENTS]: ArgumentsNode,
    [NodeType.CONTEXT]: ContextNode,
    [NodeType.FOREACH]: ForEachNode,
    [NodeType.ENTRYPOINT]: EntrypointNode,
    [NodeType.PLUGIN]: PluginNode,
    [NodeType.EXPOSURE]: ExposureNode,
    [NodeType.EXPORT]: ExportNode,
    [NodeType.IF_STATEMENT]: IfStatementNode,
    [NodeType.SWITCH_STATEMENT]: SwitchStatementNode,
    [NodeType.SWITCH_CASE]: SwitchCaseNode
};
