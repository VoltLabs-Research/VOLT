import type { PersistedPluginDTO } from '@modules/plugin/application/dtos/plugin/PersistedPluginDTO';

export interface GetPluginByIdInputDTO {
    pluginId: string;
}

export interface GetPluginByIdOutputDTO extends PersistedPluginDTO { };
