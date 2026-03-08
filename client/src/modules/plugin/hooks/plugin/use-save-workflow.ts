import usePluginBuilderStore from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { useSavePluginMutation } from './queries';
import ApiError from '@/shared/errors/ApiError';
import { sileo } from 'sileo';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCallback } from 'react';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';

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
                let message = 'You do not have permission to save this workflow';
                if (error instanceof ApiError) {
                    message = error.getFriendlyMessage();
                }
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
