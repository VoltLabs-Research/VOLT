import { usePluginByIdQuery } from '@/modules/plugin/hooks/plugin/queries';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import useAccessDenied from '@/shared/ui/hooks/use-access-denied';
import { useEffect } from 'react';

const useLoadPlugin = (id: string | undefined) => {
    const { data: plugin, isLoading, error } = usePluginByIdQuery(
        { pluginId: id! },
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

    return {
        isLoading,
        accessDenied,
        accessDeniedMessage
    };
};

export default useLoadPlugin;
