import { useCallback } from 'react';
import usePluginUseCases from './use-plugin-use-cases';
import usePluginStore from '../stores/use-plugin-store';
import type { CreatePluginInputDTO } from '../../application/dtos';
import type { Plugin } from '../../domain/entities';

const useCreatePlugin = () => {
    const { createPluginUseCase } = usePluginUseCases();
    const addPlugin = usePluginStore((state) => state.addPlugin);

    const createPlugin = useCallback(async (params: CreatePluginInputDTO): Promise<Plugin> => {
        const plugin = await createPluginUseCase.execute(params);
        addPlugin(plugin);
        return plugin;
    }, [createPluginUseCase, addPlugin]);

    return createPlugin;
};

export default useCreatePlugin;
