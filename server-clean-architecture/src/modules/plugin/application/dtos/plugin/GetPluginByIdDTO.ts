import { PluginProps } from '../../../domain/entities/Plugin';

export interface GetPluginByIdInputDTO{
    pluginId: string;
};

export interface GetPluginByIdOutputDTO extends PluginProps{};
