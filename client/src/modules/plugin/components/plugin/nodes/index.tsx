import type { NodeProps, NodeTypes } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type {
    IArgumentsData,
    IContextData,
    IExportData,
    IExposureData,
    IIfStatementData,
    IModifierData,
    ISwitchCaseData,
    ISwitchStatementData
} from '@/modules/plugin/api/entities/plugin/workflow';
import BaseNode from '@/modules/plugin/components/plugin/BaseNode';
import { CONTEXT_OPTIONS, EXPORT_TYPE_OPTIONS } from '@/modules/plugin/utilities/plugin/node-registry';
import EntrypointNode from './EntrypointNode';
import PluginNode from './PluginNode';
import './IfStatementNode/IfStatementNode.css';
import './SwitchStatementNode/SwitchStatementNode.css';

const ForEachNode = (props: NodeProps) => (
    <BaseNode {...props} nodeType={NodeType.FOREACH} description='Receives an array to iterate' />
);

const ArgumentsNode = (props: NodeProps) => {
    const argumentsData = props.data.arguments as IArgumentsData;
    return <BaseNode {...props} nodeType={NodeType.ARGUMENTS} description={`${argumentsData.arguments.length} argument(s)`} />;
};

const ExposureNode = (props: NodeProps) => {
    const exposure = (props.data.exposure as IExposureData) || {};
    return <BaseNode {...props} nodeType={NodeType.EXPOSURE} nodeTitle={exposure.name} description={exposure.results ? `Reading from ${exposure.results}` : 'Configuration needed'} />;
};

const ModifierNode = (props: NodeProps) => {
    const modifier = (props.data.modifier as IModifierData) || {};
    return <BaseNode {...props} nodeType={NodeType.MODIFIER} nodeTitle={modifier.name} description={modifier.description} />;
};

const ContextNode = (props: NodeProps) => {
    const source = (props.data.context as IContextData)?.source;
    const sourceLabel = CONTEXT_OPTIONS.find((option) => option.value === source)?.label || source;
    return <BaseNode {...props} nodeType={NodeType.CONTEXT} description={`Using ${sourceLabel}`} />;
};

const ExportNode = (props: NodeProps) => {
    const exportData = (props.data.export as IExportData) || {};
    const exportTypeLabel = EXPORT_TYPE_OPTIONS.find((v) => v.value === exportData.type)?.label;
    return <BaseNode {...props} nodeType={NodeType.EXPORT} nodeTitle={exportData.exporter} description={exportData.type ? exportTypeLabel : 'Configuration needed'} />;
};

const IfStatementNode = (props: NodeProps) => {
    const ifData = props.data.ifStatement as IIfStatementData | undefined;
    const conditionCount = ifData?.conditions?.length || 0;
    return <BaseNode {...props} nodeType={NodeType.IF_STATEMENT} description={conditionCount > 0 ? `${conditionCount} condition(s)` : 'No conditions'} />;
};

const SwitchStatementNode = (props: NodeProps) => {
    const switchData = props.data.switchStatement as ISwitchStatementData | undefined;
    const description = switchData?.expression?.trim() ? `Expression: ${switchData.expression}` : 'No expression configured';
    return <BaseNode {...props} nodeType={NodeType.SWITCH_STATEMENT} description={description} />;
};

const SwitchCaseNode = (props: NodeProps) => {
    const switchCase = (props.data.switchCase as ISwitchCaseData) || {};
    const description = switchCase.defaultCase ? 'Default case' : switchCase.value?.trim() ? `Value: ${switchCase.value}` : 'No case value configured';
    return <BaseNode {...props} nodeType={NodeType.SWITCH_CASE} description={description} />;
};

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
