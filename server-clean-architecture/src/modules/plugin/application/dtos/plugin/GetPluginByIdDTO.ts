import { PluginProps } from '@modules/plugin/domain/entities/Plugin';

export interface GetPluginByIdInputDTO{
    pluginId: string;
};

export interface GetPluginByIdOutputDTO extends PluginProps{};
