import { PluginProps } from '../../../domain/entities/Plugin';

export interface UpdatePluginByIdInputDTO {
    pluginId: string;
    workflow?: any;
    status?: string;
}

export interface UpdatePluginByIdOutputDTO extends PluginProps{}