import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import type IPluginListingRepository from '../../domain/ports/IPluginListingRepository';
import type ClonePluginUseCase from '../../application/use-cases/ClonePluginUseCase';

const usePluginUseCases = createUseCasesHook({
    clonePluginUseCase: PLUGIN_TOKENS.ClonePluginUseCase,
    pluginRepository: PLUGIN_TOKENS.PluginRepository,
    pluginListingRepository: PLUGIN_TOKENS.PluginListingRepository
}) as () => {
    clonePluginUseCase: ClonePluginUseCase;
    pluginRepository: IPluginRepository;
    pluginListingRepository: IPluginListingRepository;
};

export default usePluginUseCases;
