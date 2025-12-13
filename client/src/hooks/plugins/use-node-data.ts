import { useCallback, useMemo } from 'react';
import type { Node } from '@xyflow/react';
import usePluginBuilderStore from '@/stores/plugin-builder';

/**
 * Hook to manage node data for plugin builder editors.
 * Eliminates duplicated boilerplate across all editor components.
 * 
 * @param node - The ReactFlow node
 * @param dataKey - The key in node.data to manage (e.g., 'context', 'forEach', 'entrypoint')
 * @param defaultValue - Default value if the data doesn't exist
 */
export function useNodeData<T extends Record<string, any>>(
    node: Node,
    dataKey: string,
    defaultValue: T
): {
    data: T;
    updateField: (key: string, value: any) => void;
    updateData: (updates: Partial<T>) => void;
    setData: (newData: T) => void;
    nodeId: string;
}{
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const storeNodes = usePluginBuilderStore((state) => state.nodes);
    const storeNode = useMemo(() =>
        storeNodes.find(n => n.id === node.id),
        [storeNodes, node.id]
    );

    const data = useMemo(() => {
        const nodeData = storeNode?.data || node.data;
        return ((nodeData as Record<string, any>)?.[dataKey] || defaultValue) as T;
    }, [storeNode?.data, node.data, dataKey, defaultValue]);


    const updateField = useCallback((key: string, value: any) => {
        updateNodeData(node.id, {
            [dataKey]: { ...data, [key]: value }
        });
    }, [node.id, dataKey, data, updateNodeData]);

    const updateData = useCallback((updates: Partial<T>) => {
        updateNodeData(node.id, {
            [dataKey]: { ...data, ...updates }
        });
    }, [node.id, dataKey, data, updateNodeData]);

    const setData = useCallback((newData: T) => {
        updateNodeData(node.id, { [dataKey]: newData });
    }, [node.id, dataKey, updateNodeData]);

    return {
        data,
        updateField,
        updateData,
        setData,
        nodeId: node.id
    };
}

/**
 * Hook to manage key-value operations for nested objects in node data.
 * Used by KeyValueEditor in ExportEditor, VisualizersEditor, etc.
 * 
 * @param updateParent - Function to update the parent object
 * @param entries - Current key-value entries
 * @param defaultKeyPrefix - Prefix for auto-generated keys (e.g., 'option', 'column')
 * @param defaultValue - Default value for new entries
 */
export function useKeyValueHandlers(
    updateParent: (newEntries: Record<string, string>) => void,
    entries: Record<string, string>,
    defaultKeyPrefix: string = 'item',
    defaultValue: string = ''
) {
    const handleKeyChange = useCallback((oldKey: string, newKey: string) => {
        if (oldKey === newKey || !newKey.trim()) return;
        const newEntries: Record<string, string> = {};
        for (const [k, v] of Object.entries(entries)) {
            newEntries[k === oldKey ? newKey : k] = v;
        }
        updateParent(newEntries);
    }, [entries, updateParent]);

    const handleValueChange = useCallback((key: string, value: string) => {
        updateParent({ ...entries, [key]: value });
    }, [entries, updateParent]);

    const handleAdd = useCallback(() => {
        let counter = 1;
        let newKey = `${defaultKeyPrefix}_${counter}`;
        while (entries[newKey] !== undefined) {
            counter++;
            newKey = `${defaultKeyPrefix}_${counter}`;
        }
        updateParent({ ...entries, [newKey]: defaultValue });
    }, [entries, updateParent, defaultKeyPrefix, defaultValue]);

    const handleRemove = useCallback((key: string) => {
        const newEntries = { ...entries };
        delete newEntries[key];
        updateParent(newEntries);
    }, [entries, updateParent]);

    return {
        handleKeyChange,
        handleValueChange,
        handleAdd,
        handleRemove,
        entries: Object.entries(entries) as [string, string][]
    };
}

export default useNodeData;
