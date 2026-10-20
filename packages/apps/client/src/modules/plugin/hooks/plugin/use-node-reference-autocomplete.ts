import { useMemo } from 'react';
import type { Node } from '@xyflow/react';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import type { INodeData } from '@volt/contracts/modules/plugin/workflow';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { NODE_CONFIGS } from '@/modules/plugin/utils/plugin/node-registry';
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
    const shortId = node.id.slice(0, 8);
    const name = (node.data.modifier?.name ?? node.data.exposure?.name)?.trim();

    return `${name || NODE_CONFIGS[nodeType]?.label || nodeType} (${shortId})`;
};

const useNodeReferenceAutocomplete = (currentNodeId: string): NodeReferenceOption[] => {
    const nodes = usePluginBuilderStore((state) => state.nodes);
    const { data: schema } = useQuery({
        queryKey: ['plugin', 'node-types-schema'],
        queryFn: () => pluginService.getNodeTypesSchema(),
        staleTime: Infinity
    });

    return useMemo(() => {
        const baseProperties = schema?.nodeTypes ?? {};
        const optionsMap = new Map<string, NodeReferenceOption>();

        for (const node of nodes) {
            if (node.id === currentNodeId) continue;

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
    }, [nodes, currentNodeId, schema]);
};

export default useNodeReferenceAutocomplete;
