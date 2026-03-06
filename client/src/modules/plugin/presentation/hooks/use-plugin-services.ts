import useResolve from '@/shared/presentation/hooks/use-resolve';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';
import type IPluginRepository from '../../domain/port/IPluginRepository';
import type IPluginListingRepository from '../../domain/port/IPluginListingRepository';
import type ClonePluginUseCase from '../../application/use-cases/ClonePluginUseCase';

const usePluginUseCases = () => {
    return {
        clonePluginUseCase: useResolve<ClonePluginUseCase>(PLUGIN_TOKENS.ClonePluginUseCase),
        pluginRepository: useResolve<IPluginRepository>(PLUGIN_TOKENS.PluginRepository),
        pluginListingRepository: useResolve<IPluginListingRepository>(PLUGIN_TOKENS.PluginListingRepository)
    };
};

export default usePluginUseCases;
