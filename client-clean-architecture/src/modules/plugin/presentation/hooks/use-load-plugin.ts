import { useCallback } from 'react';
import usePluginUseCases from './use-plugin-use-cases';
import usePluginBuilderStore from '../stores/use-plugin-builder-store';

const useLoadPlugin = () => {
    const { pluginRepository } = usePluginUseCases();

    const loadWorkflow = usePluginBuilderStore((state) => state.loadWorkflow);
    const setCurrentPluginId = usePluginBuilderStore((state) => state.setCurrentPluginId);
    const setLoading = usePluginBuilderStore((state) => state.setLoading);
    const setLoadError = usePluginBuilderStore((state) => state.setLoadError);

    const loadPlugin = useCallback(async (id: string): Promise<void> => {
        setLoading(true);
        setLoadError(null);

        try {
            const plugin = await pluginRepository.getById({ id });
            loadWorkflow(plugin.workflow);
            setCurrentPluginId(plugin._id);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load plugin';
            setLoadError(message);
        } finally {
            setLoading(false);
        }
    }, [pluginRepository, loadWorkflow, setCurrentPluginId, setLoading, setLoadError]);

    return loadPlugin;
};

export default useLoadPlugin;
