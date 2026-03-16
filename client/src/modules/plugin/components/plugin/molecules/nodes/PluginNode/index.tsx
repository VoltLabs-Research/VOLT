import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import BaseNode from '@/modules/plugin/components/plugin/atoms/BaseNode';
import type { IPluginNodeData } from '@/modules/plugin/api/entities/plugin/workflow';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { NodeProps } from '@xyflow/react';

const PluginNode = (props: NodeProps) => {
    const { data } = props;
    const pluginNode = (data.pluginNode as IPluginNodeData) || {};
    const { publishedPluginsById } = usePluginSelectors();
    const pluginLabel = pluginNode.pluginId
        ? publishedPluginsById[pluginNode.pluginId]?.modifier?.name?.trim() || pluginNode.pluginId
        : '';
    const description = pluginLabel
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
