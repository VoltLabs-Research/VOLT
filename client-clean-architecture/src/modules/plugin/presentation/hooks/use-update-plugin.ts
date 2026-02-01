import { useCallback } from 'react';
import usePluginUseCases from './use-plugin-use-cases';
import usePluginStore from '../stores/use-plugin-store';
import type { UpdatePluginInputDTO } from '../../application/dtos';
import type { Plugin } from '../../domain/entities';

const useUpdatePlugin = () => {
    const { pluginRepository } = usePluginUseCases();
    const updatePluginInStore = usePluginStore((state) => state.updatePlugin);

    const updatePlugin = useCallback(async (params: UpdatePluginInputDTO): Promise<Plugin> => {
        const plugin = await pluginRepository.update(params);
        updatePluginInStore(params.id, plugin);
        return plugin;
    }, [pluginRepository, updatePluginInStore]);

    return updatePlugin;
};

export default useUpdatePlugin;
