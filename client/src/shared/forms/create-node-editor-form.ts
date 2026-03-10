import { useEffect, useMemo, useRef } from 'react';
import type { DefaultValues, FieldValues, UseFormReturn } from 'react-hook-form';
import type { Node } from '@xyflow/react';
import type { ZodSchema } from 'zod';
import type { INodeData } from '@/modules/plugin/api/entities/plugin/workflow';
import usePluginBuilderStore from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import useZodForm from '@/shared/presentation/hooks/use-zod-form';

interface UseNodeEditorFormOptions<TFormValues extends FieldValues, TDataKey extends keyof INodeData> {
    schema: ZodSchema;
    node: Node<INodeData>;
    dataKey: TDataKey;
    defaults: TFormValues;
    debounceMs?: number;
}

interface CreateNodeEditorFormOptions<TFormValues extends FieldValues, TDataKey extends keyof INodeData> {
    schema: ZodSchema;
    defaults: TFormValues;
    dataKey: TDataKey;
    debounceMs?: number;
}

const useNodeEditorForm = <TFormValues extends FieldValues, TDataKey extends keyof INodeData>(
    options: UseNodeEditorFormOptions<TFormValues, TDataKey>
): UseFormReturn<TFormValues> => {
    const {
        schema,
        node,
        dataKey,
        defaults,
        debounceMs = 300
    } = options;

    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const storeNodes = usePluginBuilderStore((state) => state.nodes);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const initialValues = useMemo((): TFormValues => {
        const storeNode = storeNodes.find((storeNodeItem) => storeNodeItem.id === node.id);
        const data = storeNode?.data ?? node.data;
        const value = data[dataKey] as TFormValues | undefined;

        return value ?? defaults;
    }, [storeNodes, node.id, node.data, dataKey, defaults]);

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
                updateNodeData(node.id, { [dataKey]: formData });
            }, debounceMs);
        });

        return () => {
            subscription.unsubscribe();

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [form, updateNodeData, node.id, dataKey, debounceMs]);

    useEffect(() => {
        form.reset(initialValues as DefaultValues<TFormValues>);
    }, [node.id]);

    return form;
};

export const createNodeEditorForm = <TFormValues extends FieldValues, TDataKey extends keyof INodeData>(
    config: CreateNodeEditorFormOptions<TFormValues, TDataKey>
) => {
    function useCreatedNodeEditorForm(node: Node<INodeData>) {
        return useNodeEditorForm<TFormValues, TDataKey>({
            schema: config.schema,
            node,
            dataKey: config.dataKey,
            defaults: config.defaults,
            debounceMs: config.debounceMs
        });
    }

    return useCreatedNodeEditorForm;
};

export default createNodeEditorForm;
