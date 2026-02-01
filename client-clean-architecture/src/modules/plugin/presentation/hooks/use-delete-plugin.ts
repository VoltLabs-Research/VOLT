import { useCallback } from 'react';
import usePluginUseCases from './use-plugin-use-cases';
import usePluginStore from '../stores/use-plugin-store';

const useDeletePlugin = () => {
    const { deletePluginUseCase } = usePluginUseCases();
    const plugins = usePluginStore((state) => state.plugins);
    const removePlugin = usePluginStore((state) => state.removePlugin);
    const setPlugins = usePluginStore((state) => state.setPlugins);

    const deletePlugin = useCallback(async (id: string): Promise<void> => {
        const previousPlugins = plugins;

        // Optimistic delete
        removePlugin(id);

        try {
            await deletePluginUseCase.execute({ id });
        } catch (error) {
            // Rollback on error
            setPlugins(previousPlugins);
            throw error;
        }
    }, [deletePluginUseCase, plugins, removePlugin, setPlugins]);

    return deletePlugin;
};

export default useDeletePlugin;
