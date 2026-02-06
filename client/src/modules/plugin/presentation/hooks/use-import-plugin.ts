import { useCallback } from 'react';
import usePluginUseCases from './use-plugin-use-cases';
import usePluginStore from '../stores/use-plugin-store';
import type { Plugin } from '../../domain/entities';

const useImportPlugin = () => {
    const { pluginRepository } = usePluginUseCases();
    const addPlugin = usePluginStore((state) => state.addPlugin);

    const importPlugin = useCallback(async (file: File): Promise<Plugin> => {
        const plugin = await pluginRepository.importPlugin(file);
        addPlugin(plugin);
        return plugin;
    }, [pluginRepository, addPlugin]);

    return importPlugin;
};

export default useImportPlugin;
