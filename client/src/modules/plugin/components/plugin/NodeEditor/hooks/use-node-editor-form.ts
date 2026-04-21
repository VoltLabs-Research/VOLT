import usePluginBuilderStore from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef } from 'react';
import type { INodeData } from '@/modules/plugin/api/entities/plugin/workflow';
import type { Node } from '@xyflow/react';
import { useForm } from 'react-hook-form';
import type { DefaultValues, FieldValues, Resolver, UseFormReturn } from 'react-hook-form';
import type { ZodSchema } from 'zod';

interface UseNodeEditorFormOptions<TFormValues extends FieldValues, TDataKey extends keyof INodeData> {
    schema: ZodSchema;
    node: Node<INodeData>;
    dataKey: TDataKey;
    defaults: TFormValues;
};

interface CreateNodeEditorFormOptions<TFormValues extends FieldValues, TDataKey extends keyof INodeData> {
    schema: ZodSchema;
    defaults: TFormValues;
    dataKey: TDataKey;
};

const useNodeEditorForm = <TFormValues extends FieldValues, TDataKey extends keyof INodeData>(
    options: UseNodeEditorFormOptions<TFormValues, TDataKey>
): UseFormReturn<TFormValues> => {
    const {
        schema,
        node,
        dataKey,
        defaults
    } = options;

    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const storeNodes = usePluginBuilderStore((state) => state.nodes);

    const initialValues = useMemo((): TFormValues => {
        const storeNode = storeNodes.find((storeNodeItem) => storeNodeItem.id === node.id);
        const data = storeNode?.data ?? node.data;
        const value = data[dataKey];

        if (value === undefined) {
            return defaults;
        }

        return value as TFormValues;
    }, [storeNodes, node.id, node.data, dataKey, defaults]);

    const resolver = zodResolver(schema as never) as unknown as Resolver<TFormValues>;
    const form = useForm<TFormValues>({
        resolver,
        defaultValues: initialValues as DefaultValues<TFormValues>,
        mode: 'onChange'
    });
    const previousNodeIdRef = useRef(node.id);

    useEffect(() => {
        const subscription = form.watch((formData) => {
            updateNodeData(node.id, { [dataKey]: formData });
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [form, updateNodeData, node.id, dataKey]);

    useEffect(() => {
        if (previousNodeIdRef.current === node.id) {
            return;
        }

        previousNodeIdRef.current = node.id;
        form.reset(initialValues as DefaultValues<TFormValues>);
    }, [form, initialValues, node.id]);

    return form;
};

export const createNodeEditorForm = <TFormValues extends FieldValues, TDataKey extends keyof INodeData>(
    config: CreateNodeEditorFormOptions<TFormValues, TDataKey>
) => {
    return function useCreatedNodeEditorForm(node: Node<INodeData>) {
        return useNodeEditorForm<TFormValues, TDataKey>({
            schema: config.schema,
            node,
            dataKey: config.dataKey,
            defaults: config.defaults
        });
    };
};

export default createNodeEditorForm;
