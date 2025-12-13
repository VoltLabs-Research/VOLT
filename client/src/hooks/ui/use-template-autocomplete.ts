import { useMemo, useEffect, useState } from 'react';
import { getAllAutocompletePaths, type NodeOutputSchema, type NodeSchema } from '@/utilities/plugins/node-schemas';
import usePluginBuilderStore from '@/stores/plugins/plugin-builder';
import pluginApi from '@/services/api/plugin';

export interface AutocompleteSuggestion extends NodeSchema{
    display: string;
};

let schemasCache: Record<string, NodeOutputSchema> | null = null;

/**
 * Get autocomplete suggestions for {{ }} templates.
 */
const useTemplateAutocomplete = (currentNodeId?: string): AutocompleteSuggestion[] => {
    const nodes = usePluginBuilderStore((state) => state.nodes);
    const edges = usePluginBuilderStore((state) => state.edges);
    const [schemas, setSchemas] = useState<Record<string, NodeOutputSchema> | null>(schemasCache);

    useEffect(() => {
        if(schemasCache) return;

        pluginApi.getNodeSchemas().then((data) => {
            schemasCache = data;
            setSchemas(data);
        }).catch(() => {
            schemasCache = {};
            setSchemas({});
        });
    }, []);

    return useMemo(() => {
        if(!schemas) return [];

        // get all ancstors nodes(nodes that execute before current)
        // TODO: maybe duplicated code
        const ancestorIds = new Set<string>();
        if(currentNodeId){
            const visited = new Set<string>();
            const queue = [currentNodeId];

            while(queue.length > 0){
                const nodeId = queue.shift()!;
                if(visited.has(nodeId)) continue;
                visited.add(nodeId);

                const incomingEdges = edges.filter((edge) => edge.target === nodeId);
                for(const edge of incomingEdges){
                    ancestorIds.add(edge.source);
                    queue.push(edge.source);
                }
            }
        }

        const relevantNodes = nodes
            .filter((node) => !currentNodeId || ancestorIds.has(node.id))
            .map((node) => ({ id: node.id, type: node.type as string }));

        const paths = getAllAutocompletePaths(relevantNodes, schemas);
        return paths.map((path) => ({
            ...path,
            display: `{{ ${path.path} }}`
        }));
    }, [nodes, edges, currentNodeId, schemas]);
};

/**
 * Filter suggestions based on user input
 */
export const filterSuggestions = (
    suggestions: AutocompleteSuggestion[],
    query: string
): AutocompleteSuggestion[] => {
    if(!query) return suggestions;
    const lowerQuery = query.toLowerCase();
    return suggestions
        .filter((suggestion) => suggestion.path.toLowerCase().includes(lowerQuery));
};

export default useTemplateAutocomplete;
