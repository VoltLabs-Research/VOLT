import { ArgumentType, NodeType } from '@volt/contracts/modules/plugin/enums';
import type { Node } from '@xyflow/react';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type {
    IArgumentDefinition,
    INodeData
} from '@volt/contracts/modules/plugin/workflow';

export interface ArgumentReferenceCandidate {
    argument: IArgumentDefinition;
    pluginReferenceDefinitions: IArgumentDefinition[];
    supportsMultipleExecutions: boolean;
}

const collectPluginReferenceDefinitions = (
    argument: IArgumentDefinition
): IArgumentDefinition[] => {
    if (argument.type === ArgumentType.PLUGIN_REFERENCE) {
        return [argument];
    }

    if (argument.type !== ArgumentType.LIST) {
        return [];
    }

    return (argument.listArguments ?? []).flatMap(collectPluginReferenceDefinitions);
};

export const collectArgumentReferenceCandidates = (
    nodes: Node<INodeData>[]
): ArgumentReferenceCandidate[] => {
    const argumentsNode = nodes.find((candidate) => candidate.type === NodeType.ARGUMENTS);

    return (argumentsNode?.data.arguments?.arguments ?? []).flatMap((argument) => {
        const pluginReferenceDefinitions = collectPluginReferenceDefinitions(argument);
        if (pluginReferenceDefinitions.length === 0 || !argument.argument.trim()) {
            return [];
        }

        return [{
            argument,
            pluginReferenceDefinitions,
            supportsMultipleExecutions: argument.type === ArgumentType.LIST
                || pluginReferenceDefinitions.some((definition) => definition.multipleSelection)
        }];
    });
};

export const resolveReferencedPluginIds = (
    candidate: ArgumentReferenceCandidate | undefined,
    selectablePlugins: Plugin[]
): string[] => {
    if (!candidate) {
        return [];
    }

    const referencedPluginIds = new Set<string>();
    for (const definition of candidate.pluginReferenceDefinitions) {
        for (const pluginId of definition.pluginReferenceFilter ?? []) {
            referencedPluginIds.add(pluginId);
        }

        const allowedPluginKeys = new Set(definition.pluginReferenceFilterKeys ?? []);
        if (allowedPluginKeys.size === 0) {
            continue;
        }

        for (const plugin of selectablePlugins) {
            const pluginKey = plugin.modifier?.key?.trim();
            if (pluginKey && allowedPluginKeys.has(pluginKey)) {
                referencedPluginIds.add(plugin._id);
            }
        }
    }

    if (referencedPluginIds.size > 0) {
        return Array.from(referencedPluginIds);
    }

    return selectablePlugins.map((plugin) => plugin._id);
};
