import { usePluginByIdQuery } from './queries';
import usePluginBuilderStore from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import ApiError from '@/shared/errors/ApiError';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useEffect } from 'react';

const useLoadPlugin = (id: string | undefined) => {
    const { data: plugin, isLoading, error } = usePluginByIdQuery(
        { _id: id! },
        { enabled: !!id }
    );

    const loadWorkflow = usePluginBuilderStore((state) => state.loadWorkflow);
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    useEffect(() => {
        if (error) {
            checkRBACError(error);
        }
    }, [error, checkRBACError]);

    useEffect(() => {
        if (plugin) {
            loadWorkflow(plugin.workflow);
        }
    }, [plugin, loadWorkflow]);

    let loadError: string | null = null;
    if (error) {
        if (error instanceof ApiError) {
            loadError = error.getFriendlyMessage();
        } else {
            loadError = error.message;
        }
    }

    return {
        isLoading,
        loadError,
        accessDenied,
        accessDeniedMessage
    };
};

export default useLoadPlugin;
