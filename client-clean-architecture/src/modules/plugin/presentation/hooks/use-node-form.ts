import { useMemo } from 'react';
import type { Node } from '@xyflow/react';
import useForm from '@/shared/presentation/hooks/use-form';
import usePluginBuilderStore from '../stores/use-plugin-builder-store';
import type { INodeData } from '../../domain/entities';

/**
 * Hook that combines useForm with plugin builder store for node editors.
 * Auto-saves form changes to the store.
 */
export const useNodeForm = <T extends Record<string, any>>(
    node: Node<INodeData>,
    dataKey: keyof INodeData,
    defaultValue: T
) => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const storeNodes = usePluginBuilderStore((state) => state.nodes);

    const initialValues = useMemo((): T => {
        const storeNode = storeNodes.find((n) => n.id === node.id);
        const data = storeNode?.data ?? node.data;
        const value = data[dataKey] as T | undefined;
        return value ?? defaultValue;
    }, [storeNodes, node.id, node.data, dataKey, defaultValue]);

    return useForm<T>({
        initialValues,
        onAutoSave: (data) => {
            updateNodeData(node.id, { [dataKey]: data });
        },
        autoSaveDelay: 300,
        autoSaveOnlyIfChanged: true
    });
};

export default useNodeForm;
