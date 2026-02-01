import { useCallback } from 'react';
import usePluginUseCases from './use-plugin-use-cases';
import usePluginStore from '../stores/use-plugin-store';
import type { UpdatePluginInputDTO } from '../../application/dtos';
import type { Plugin } from '../../domain/entities';

const useUpdatePlugin = () => {
    const { updatePluginUseCase } = usePluginUseCases();
    const updatePluginInStore = usePluginStore((state) => state.updatePlugin);

    const updatePlugin = useCallback(async (params: UpdatePluginInputDTO): Promise<Plugin> => {
        const plugin = await updatePluginUseCase.execute(params);
        updatePluginInStore(params.id, plugin);
        return plugin;
    }, [updatePluginUseCase, updatePluginInStore]);

    return updatePlugin;
};

export default useUpdatePlugin;
