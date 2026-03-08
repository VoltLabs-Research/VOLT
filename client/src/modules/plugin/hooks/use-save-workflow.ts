import { useCallback } from 'react';
import usePluginBuilderStore from '../stores/use-plugin-builder-store';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useSavePluginMutation } from './plugin/queries';
import ApiError from '@/shared/errors/ApiError';
import { sileo } from 'sileo';
import type { Plugin } from '../api/entities/plugin';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';

const useSaveWorkflow = () => {
    const { searchParams, updateSearchParams } = useSearchParamsState();
    const getWorkflow = usePluginBuilderStore((state) => state.getWorkflow);
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

            if (!currentPluginId) {
                updateSearchParams({ id: plugin._id }, { replace: true });
            }

            return plugin;
        } catch (error) {
            if (ApiError.isRBACError(error)) {
                const message = error instanceof ApiError
                    ? error.getFriendlyMessage()
                    : 'You do not have permission to save this workflow';
                setSaveError(message);
                sileo.error({ title: message });
                return null;
            }
            const message = error instanceof Error ? error.message : 'Failed to save workflow';
            setSaveError(message);
            return null;
        } finally {
            setSaving(false);
        }
    }, [
        getWorkflow,
        savePluginMutationResult,
        setSaving,
        setSaveError,
        searchParams,
        updateSearchParams
    ]);

    return saveWorkflow;
};

export default useSaveWorkflow;
