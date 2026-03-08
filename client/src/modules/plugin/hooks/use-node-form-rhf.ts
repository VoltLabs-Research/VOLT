import { useEffect, useRef, useMemo } from 'react';
import { type FieldValues, type DefaultValues } from 'react-hook-form';
import type { ZodSchema } from 'zod';
import type { Node } from '@xyflow/react';
import useZodForm from '@/shared/presentation/hooks/use-zod-form';
import usePluginBuilderStore from '../stores/use-plugin-builder-store';
import type { INodeData } from '../api/entities/workflow';

interface UseNodeFormRHFOptions<TFormValues extends FieldValues> {
    schema: ZodSchema;
    nodeId: string;
    dataKey: keyof INodeData;
    node: Node<INodeData>;
    defaultValue: TFormValues;
    debounceMs?: number;
}

const useNodeFormRHF = <TFormValues extends FieldValues>(
    options: UseNodeFormRHFOptions<TFormValues>
) => {
    const {
        schema,
        nodeId,
        dataKey,
        node,
        defaultValue,
        debounceMs = 300
    } = options;

    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const storeNodes = usePluginBuilderStore((state) => state.nodes);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const initialValues = useMemo((): TFormValues => {
        const storeNode = storeNodes.find((storeNodeItem) => storeNodeItem.id === node.id);
        const data = storeNode?.data ?? node.data;
        const value = data[dataKey] as TFormValues | undefined;
        return value ?? defaultValue;
    }, [storeNodes, node.id, node.data, dataKey, defaultValue]);

    const form = useZodForm<TFormValues>({
        schema,
        defaultValues: initialValues as DefaultValues<TFormValues>,
        mode: 'onChange'
    });

    useEffect(() => {
        const subscription = form.watch((formData) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                updateNodeData(nodeId, { [dataKey]: formData });
            }, debounceMs);
        });
        return () => {
            subscription.unsubscribe();
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [form, updateNodeData, nodeId, dataKey, debounceMs]);

    useEffect(() => {
        form.reset(initialValues as DefaultValues<TFormValues>);
    }, [nodeId]);

    return form;
};

export default useNodeFormRHF;
