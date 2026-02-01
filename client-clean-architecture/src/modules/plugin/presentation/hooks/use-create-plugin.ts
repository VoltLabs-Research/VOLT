import { useCallback } from 'react';
import usePluginUseCases from './use-plugin-use-cases';
import usePluginStore from '../stores/use-plugin-store';
import type { CreatePluginInputDTO } from '../../application/dtos';
import type { Plugin } from '../../domain/entities';

const useCreatePlugin = () => {
    const { pluginRepository } = usePluginUseCases();
    const addPlugin = usePluginStore((state) => state.addPlugin);

    const createPlugin = useCallback(async (params: CreatePluginInputDTO): Promise<Plugin> => {
        const plugin = await pluginRepository.create(params);
        addPlugin(plugin);
        return plugin;
    }, [pluginRepository, addPlugin]);

    return createPlugin;
};

export default useCreatePlugin;
