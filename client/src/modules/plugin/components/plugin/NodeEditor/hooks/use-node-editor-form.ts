import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { useEffect, useMemo, useRef } from 'react';
import type { INodeData } from '@volt/contracts/modules/plugin/workflow';
import type { Node } from '@xyflow/react';
import { useForm } from 'react-hook-form';
import type { DefaultValues, FieldValues, UseFormReturn } from 'react-hook-form';

/**
 * Binds a react-hook-form instance to one slice of a builder node's data,
 * writing every change back to the builder store.
 */
const useNodeEditorForm = <TFormValues extends FieldValues>(
    node: Node<INodeData>,
    dataKey: keyof INodeData,
    defaults: TFormValues
): UseFormReturn<TFormValues> => {
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const storeNodes = usePluginBuilderStore((state) => state.nodes);

    const initialValues = useMemo((): TFormValues => {
        const storeNode = storeNodes.find((storeNodeItem) => storeNodeItem.id === node.id);
        const value = (storeNode?.data ?? node.data)[dataKey];

        return value === undefined ? defaults : value as TFormValues;
    }, [storeNodes, node.id, node.data, dataKey, defaults]);

    const form = useForm<TFormValues>({
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

export default useNodeEditorForm;
