import { useEffect } from 'react';
import { usePluginByIdQuery } from './plugin/queries';
import usePluginBuilderStore from '../stores/use-plugin-builder-store';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import ApiError from '@/shared/errors/ApiError';

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

    const loadError = error
        ? (error instanceof ApiError ? error.getFriendlyMessage() : error.message)
        : null;

    return { isLoading, loadError, accessDenied, accessDeniedMessage };
};

export default useLoadPlugin;
