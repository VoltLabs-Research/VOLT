import { useMemo } from 'react';
import { container } from 'tsyringe';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';
import type IPluginRepository from '../../domain/port/IPluginRepository';
import type IPluginListingRepository from '../../domain/port/IPluginListingRepository';
import type ClonePluginUseCase from '../../application/use-cases/ClonePluginUseCase';

const usePluginUseCases = () => {
    return useMemo(() => ({
        clonePluginUseCase: container.resolve<ClonePluginUseCase>(PLUGIN_TOKENS.ClonePluginUseCase),
        pluginRepository: container.resolve<IPluginRepository>(PLUGIN_TOKENS.PluginRepository),
        pluginListingRepository: container.resolve<IPluginListingRepository>(PLUGIN_TOKENS.PluginListingRepository)
    }), []);
};

export default usePluginUseCases;
