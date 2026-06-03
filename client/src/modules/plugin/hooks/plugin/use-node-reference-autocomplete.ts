import { useMemo } from 'react';
import type { Node } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { INodeData } from '@/modules/plugin/api/entities/plugin/workflow';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { NODE_CONFIGS } from '@/modules/plugin/utilities/plugin/node-registry';
import pluginService from '@/modules/plugin/api/services/plugin-service';
import { useQuery } from '@tanstack/react-query';

interface NodeReferenceOption {
    value: string;
    label: string;
}

const getNodeOutputProperties = (node: Node<INodeData>, baseProperties: Record<string, string[]>): string[] => {
    const nodeType = node.type as NodeType;
    const base = baseProperties[nodeType] ?? [];
    const dynamicProperties: string[] = [];

    if (nodeType === NodeType.ARGUMENTS) {
        const argumentKeys = (node.data.arguments?.arguments ?? [])
            .map((arg) => arg.argument?.trim())
            .filter((arg): arg is string => Boolean(arg));
        dynamicProperties.push(...argumentKeys);
    }

    return Array.from(new Set([...base, ...dynamicProperties]));
};

const getNodeLabel = (node: Node<INodeData>): string => {
    const nodeType = node.type as NodeType;
    const fallback = NODE_CONFIGS[nodeType]?.label ?? nodeType;
    const shortId = node.id.slice(0, 8);

    if (nodeType === NodeType.MODIFIER) {
        const name = node.data.modifier?.name?.trim();
        if (name) return `${name} (${shortId})`;
    }

    if (nodeType === NodeType.EXPOSURE) {
        const name = node.data.exposure?.name?.trim();
        if (name) return `${name} (${shortId})`;
    }

    return `${fallback} (${shortId})`;
};

const useNodeReferenceAutocomplete = (currentNodeId: string): NodeReferenceOption[] => {
    const nodes = usePluginBuilderStore((state) => state.nodes);
    const { data: schema } = useQuery({
        queryKey: ['plugin', 'node-types-schema'],
        queryFn: () => pluginService.getNodeTypesSchema(),
        staleTime: Infinity
    });

    const baseProperties = schema?.nodeTypes ?? {};

    return useMemo(() => {
        const optionsMap = new Map<string, NodeReferenceOption>();

        for (const rawNode of nodes) {
            const node = rawNode as Node<INodeData>;
            if (!node?.id || node.id === currentNodeId) continue;

            const properties = getNodeOutputProperties(node, baseProperties);
            const nodeLabel = getNodeLabel(node);

            for (const property of properties) {
                const expression = `{{ ${node.id}.${property} }}`;
                if (optionsMap.has(expression)) continue;

                optionsMap.set(expression, {
                    value: expression,
                    label: `${nodeLabel} · ${property}`
                });
            }
        }

        return Array.from(optionsMap.values());
    }, [nodes, currentNodeId, baseProperties]);
};

export default useNodeReferenceAutocomplete;
