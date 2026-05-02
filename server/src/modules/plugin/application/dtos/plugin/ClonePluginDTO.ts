import type { PersistedPluginDTO } from '@modules/plugin/application/dtos/plugin/PersistedPluginDTO';

export interface ClonePluginInputDTO {
    pluginId: string;
    teamId: string;
}

export interface ClonePluginOutputDTO {
    plugin: PersistedPluginDTO;
}
