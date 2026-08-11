import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { useSavePluginMutation } from './queries';
import { isAccessDeniedError, reportError } from '@/shared/errors/core/report-error';
import { ErrorSurface } from '@/shared/contracts/errors';
import { applySearchParamUpdates } from '@/shared/ui/hooks/use-search-params';
import { showPromise } from '@/shared/ui/hooks/toast';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';

const useSaveWorkflow = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const getWorkflow = usePluginBuilderStore((state) => state.getWorkflow);
    const setSaving = usePluginBuilderStore((state) => state.setSaving);

    const savePluginMutationResult = useSavePluginMutation();

    const saveWorkflow = useCallback(async (): Promise<Plugin | null> => {
        const currentPluginId = searchParams.get('id') ?? null;
        setSaving(true);

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
                reportError(error, {
                    surface: ErrorSurface.Toast,
                    fallbackTitle: 'You do not have permission to save this workflow'
                });
            }

            return null;
        } finally {
            setSaving(false);
        }
    }, [
        getWorkflow,
        savePluginMutationResult,
        setSaving,
        searchParams,
        setSearchParams
    ]);

    return saveWorkflow;
};

export default useSaveWorkflow;
