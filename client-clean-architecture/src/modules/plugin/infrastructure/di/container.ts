import { container } from 'tsyringe';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import type IPluginListingRepository from '../../domain/ports/IPluginListingRepository';
import PluginRepository from '../repositories/PluginRepository';
import PluginListingRepository from '../repositories/PluginListingRepository';
import {
    GetPluginsUseCase,
    GetPluginUseCase,
    CreatePluginUseCase,
    ClonePluginUseCase,
    UpdatePluginUseCase,
    DeletePluginUseCase,
    ExecutePluginUseCase,
    ExportPluginUseCase,
    ImportPluginUseCase,
    UploadBinaryUseCase,
    DeleteBinaryUseCase,
    GetPluginListingUseCase
} from '../../application/use-cases';
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

    container.register(PLUGIN_TOKENS.GetPluginsUseCase, GetPluginsUseCase);
    container.register(PLUGIN_TOKENS.GetPluginUseCase, GetPluginUseCase);
    container.register(PLUGIN_TOKENS.CreatePluginUseCase, CreatePluginUseCase);
    container.register(PLUGIN_TOKENS.ClonePluginUseCase, ClonePluginUseCase);
    container.register(PLUGIN_TOKENS.UpdatePluginUseCase, UpdatePluginUseCase);
    container.register(PLUGIN_TOKENS.DeletePluginUseCase, DeletePluginUseCase);
    container.register(PLUGIN_TOKENS.ExecutePluginUseCase, ExecutePluginUseCase);
    container.register(PLUGIN_TOKENS.ExportPluginUseCase, ExportPluginUseCase);
    container.register(PLUGIN_TOKENS.ImportPluginUseCase, ImportPluginUseCase);
    container.register(PLUGIN_TOKENS.UploadBinaryUseCase, UploadBinaryUseCase);
    container.register(PLUGIN_TOKENS.DeleteBinaryUseCase, DeleteBinaryUseCase);
    container.register(PLUGIN_TOKENS.GetPluginListingUseCase, GetPluginListingUseCase);

    initialized = true;
};
