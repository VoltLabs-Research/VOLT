import { useCallback } from 'react';
import usePluginUseCases from './use-plugin-services';
import usePluginBuilderStore from '../stores/use-plugin-builder-store';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';

const useLoadPlugin = () => {
    const { pluginRepository } = usePluginUseCases();

    const loadWorkflow = usePluginBuilderStore((state) => state.loadWorkflow);
    const setCurrentPluginId = usePluginBuilderStore((state) => state.setCurrentPluginId);
    const setLoading = usePluginBuilderStore((state) => state.setLoading);
    const setLoadError = usePluginBuilderStore((state) => state.setLoadError);
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    const loadPlugin = useCallback(async (id: string): Promise<void> => {
        setLoading(true);
        setLoadError(null);

        try {
            const plugin = await pluginRepository.getById({ id });
            loadWorkflow(plugin.workflow);
            setCurrentPluginId(plugin._id);
        } catch (error) {
            if(checkRBACError(error)) return;
            const message = error instanceof Error ? error.message : 'Failed to load plugin';
            setLoadError(message);
        } finally {
            setLoading(false);
        }
    }, [pluginRepository, loadWorkflow, setCurrentPluginId, setLoading, setLoadError, checkRBACError]);

    return { loadPlugin, accessDenied, accessDeniedMessage };
};

export default useLoadPlugin;
