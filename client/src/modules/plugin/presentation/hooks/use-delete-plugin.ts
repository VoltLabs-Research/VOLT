import { useCallback } from 'react';
import usePluginUseCases from './use-plugin-services';
import usePluginStore from '../stores/use-plugin-store';

const useDeletePlugin = () => {
    const { pluginRepository } = usePluginUseCases();
    const plugins = usePluginStore((state) => state.plugins);
    const removePlugin = usePluginStore((state) => state.removePlugin);
    const setPlugins = usePluginStore((state) => state.setPlugins);

    return useCallback(async (id: string): Promise<void> => {
        const previousItems = plugins;
        removePlugin(id);
        try {
            await pluginRepository.delete(id);
        } catch (error) {
            setPlugins(previousItems);
            throw error;
        }
    }, [pluginRepository, plugins, removePlugin, setPlugins]);
};

export default useDeletePlugin;
