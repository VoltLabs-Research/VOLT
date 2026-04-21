import { NodeType, PluginNodeExecutionMode } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import BaseNode from '@/modules/plugin/components/plugin/BaseNode';
import type { IPluginNodeData } from '@/modules/plugin/api/entities/plugin/workflow';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { NodeProps } from '@xyflow/react';

const PluginNode = (props: NodeProps) => {
    const { data } = props;
    const pluginNode = (data.pluginNode as IPluginNodeData) || {};
    const { publishedPluginsById } = usePluginSelectors();
    const executionMode = pluginNode.executionMode ?? PluginNodeExecutionMode.MANUAL;
    const pluginLabel = pluginNode.pluginId
        ? publishedPluginsById[pluginNode.pluginId]?.modifier?.name?.trim() || pluginNode.pluginId
        : '';
    const description = executionMode === PluginNodeExecutionMode.ARGUMENT_REFERENCE
        ? pluginNode.argumentReference
            ? `From argument: ${pluginNode.argumentReference}`
            : 'No argument reference selected'
        : pluginLabel
            ? `Plugin: ${pluginLabel}`
            : 'No plugin selected';

    return (
        <BaseNode
            {...props}
            nodeType={NodeType.PLUGIN}
            description={description}
        />
    );
};

export default PluginNode;
