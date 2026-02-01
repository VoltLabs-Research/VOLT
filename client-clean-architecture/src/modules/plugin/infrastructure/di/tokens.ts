export const PLUGIN_TOKENS = {
    PluginRepository: Symbol('PluginRepository'),
    PluginListingRepository: Symbol('PluginListingRepository'),
    GetPluginsUseCase: Symbol('GetPluginsUseCase'),
    GetPluginUseCase: Symbol('GetPluginUseCase'),
    CreatePluginUseCase: Symbol('CreatePluginUseCase'),
    ClonePluginUseCase: Symbol('ClonePluginUseCase'),
    UpdatePluginUseCase: Symbol('UpdatePluginUseCase'),
    DeletePluginUseCase: Symbol('DeletePluginUseCase'),
    ExecutePluginUseCase: Symbol('ExecutePluginUseCase'),
    ExportPluginUseCase: Symbol('ExportPluginUseCase'),
    ImportPluginUseCase: Symbol('ImportPluginUseCase'),
    UploadBinaryUseCase: Symbol('UploadBinaryUseCase'),
    DeleteBinaryUseCase: Symbol('DeleteBinaryUseCase'),
    GetPluginListingUseCase: Symbol('GetPluginListingUseCase')
} as const;
