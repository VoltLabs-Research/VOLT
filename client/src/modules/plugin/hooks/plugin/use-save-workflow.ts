import usePluginBuilderStore from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { useSavePluginMutation } from './queries';
import { isAccessDeniedError, reportError, ErrorSurface } from '@/shared/errors/core';
import { applySearchParamUpdates } from '@/shared/presentation/hooks/use-search-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';

const useSaveWorkflow = () => {
    const [searchParams, setSearchParams] = useSearchParams();
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
                setSearchParams((prev) => applySearchParamUpdates(prev, { id: plugin._id }), { replace: true });
            }

            return plugin;
        } catch (error) {
            if (isAccessDeniedError(error)) {
                const userError = reportError(error, { surface: ErrorSurface.Toast, fallbackTitle: 'You do not have permission to save this workflow' });
                setSaveError(userError.title || 'You do not have permission to save this workflow');
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
        setSearchParams
    ]);

    return saveWorkflow;
};

export default useSaveWorkflow;
