import { useCallback, useMemo, type ChangeEvent } from 'react';
import type { Node } from '@xyflow/react';
import usePluginBuilderStore from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import type { INodeData } from '@/modules/plugin/api/entities/plugin/workflow';

/**
 * Hook for managing array/collection data within node editors.
 * Provides CRUD operations for items in arrays without fallbacks.
 */
export const useNodeCollectionForm = <T extends object>(
    node: Node<INodeData>,
    dataKey: keyof INodeData,
    itemsKey: string,
    createDefaultItem: () => T
) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const storeNodes = usePluginBuilderStore((state) => state.nodes);

    const items = useMemo((): T[] => {
        const storeNode = storeNodes.find((n) => n.id === node.id);
        const data = storeNode?.data ?? node.data;
        const containerData = data[dataKey] as Record<string, unknown> | undefined;
        return (containerData?.[itemsKey] as T[]) ?? [];
    }, [storeNodes, node.id, node.data, dataKey, itemsKey]);

    const updateItems = useCallback((newItems: T[]) => {
        updateNodeData(node.id, {
            [dataKey]: { [itemsKey]: newItems }
        });
    }, [node.id, dataKey, itemsKey, updateNodeData]);

    const addItem = useCallback(() => {
        updateItems([...items, createDefaultItem()]);
    }, [items, updateItems, createDefaultItem]);

    const updateItem = useCallback((index: number, field: keyof T, value: unknown) => {
        const updatedItems = items.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        );
        updateItems(updatedItems);
    }, [items, updateItems]);

    const removeItem = useCallback((index: number) => {
        updateItems(items.filter((_, i) => i !== index));
    }, [items, updateItems]);

    const createFieldHandler = useCallback((index: number, field: keyof T) => {
        return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
            updateItem(index, field, e.target.value);
        };
    }, [updateItem]);

    const getItemValue = useCallback(<K extends keyof T>(index: number, field: K): T[K] => {
        return items[index]?.[field] as T[K];
    }, [items]);

    return {
        items,
        addItem,
        updateItem,
        removeItem,
        createFieldHandler,
        getItemValue,
        updateItems
    };
};

export default useNodeCollectionForm;
