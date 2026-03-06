import { container } from 'tsyringe';
import type IPluginRepository from '../../domain/port/IPluginRepository';
import type IPluginListingRepository from '../../domain/port/IPluginListingRepository';
import PluginRepository from '../repositories/PluginRepository';
import PluginListingRepository from '../repositories/PluginListingRepository';
import ClonePluginUseCase from '../../application/use-cases/ClonePluginUseCase';
import { PLUGIN_TOKENS } from './tokens';

let initialized = false;

export const ensurePluginDI = (): void => {
    if (initialized) return;

    container.register<IPluginRepository>(
        PLUGIN_TOKENS.PluginRepository,
        PluginRepository
    );

    container.register<IPluginListingRepository>(
        PLUGIN_TOKENS.PluginListingRepository,
        PluginListingRepository
    );

    container.register(PLUGIN_TOKENS.ClonePluginUseCase, ClonePluginUseCase);

    initialized = true;
};
