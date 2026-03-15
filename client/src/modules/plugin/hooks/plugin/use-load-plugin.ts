import { usePluginByIdQuery } from './queries';
import usePluginBuilderStore from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { normalizeError } from '@/shared/errors/core';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useEffect } from 'react';

const useLoadPlugin = (id: string | undefined) => {
    const { data: plugin, isLoading, error } = usePluginByIdQuery(
        { _id: id! },
        { enabled: !!id }
    );

    const loadWorkflow = usePluginBuilderStore((state) => state.loadWorkflow);
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    useEffect(() => {
        if (error) {
            checkAccessDeniedError(error);
        }
    }, [error, checkAccessDeniedError]);

    useEffect(() => {
        if (plugin) {
            loadWorkflow(plugin.workflow);
        }
    }, [plugin, loadWorkflow]);

    let loadError: string | null = null;
    if (error) {
        loadError = normalizeError(error).friendlyMessage || 'Failed to load plugin';
    }

    return {
        isLoading,
        loadError,
        accessDenied,
        accessDeniedMessage
    };
};

export default useLoadPlugin;
