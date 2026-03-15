import usePluginBuilderStore from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { useSavePluginMutation } from './queries';
import { mapErrorToUserMessage, normalizeError } from '@/shared/errors/core';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCallback } from 'react';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';

const useSaveWorkflow = () => {
    const { searchParams, updateSearchParams } = useSearchParamsState();
    const getWorkflow = usePluginBuilderStore((state) => state.getWorkflow);
    const markWorkflowSaved = usePluginBuilderStore((state) => state.markWorkflowSaved);
    const setSaving = usePluginBuilderStore((state) => state.setSaving);
    const setSaveError = usePluginBuilderStore((state) => state.setSaveError);

    const savePluginMutationResult = useSavePluginMutation();

    const saveWorkflow = useCallback(async (): Promise<Plugin | null> => {
        const currentPluginId = searchParams.get('id') ?? null;
        setSaving(true);
        setSaveError(null);

        try {
            const workflow = getWorkflow();
            const isUpdate = !!currentPluginId;

            const plugin = await showPromise(
                savePluginMutationResult.mutateAsync({
                    _id: currentPluginId || undefined,
                    workflow
                }),
                {
                    loading: { title: isUpdate ? 'Saving workflow...' : 'Creating workflow...' },
                    success: { title: isUpdate ? 'Workflow saved' : 'Workflow created' },
                    error: { title: 'Failed to save workflow' }
                }
            );

            markWorkflowSaved();

            if (!currentPluginId) {
                updateSearchParams({ id: plugin._id }, { replace: true });
            }

            return plugin;
        } catch (error) {
            const userError = mapErrorToUserMessage(normalizeError(error), {
                fallbackTitle: 'Failed to save workflow'
            });

            setSaveError(userError.title);
            return null;
        } finally {
            setSaving(false);
        }
    }, [
        getWorkflow,
        markWorkflowSaved,
        savePluginMutationResult,
        setSaving,
        setSaveError,
        searchParams,
        updateSearchParams
    ]);

    return saveWorkflow;
};

export default useSaveWorkflow;
