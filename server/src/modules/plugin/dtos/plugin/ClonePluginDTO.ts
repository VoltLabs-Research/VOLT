import type { PersistedPluginDTO } from '@modules/plugin/dtos/plugin/PersistedPluginDTO';

export interface ClonePluginInputDTO {
    pluginId: string;
    teamId: string;
}

export interface ClonePluginOutputDTO {
    plugin: PersistedPluginDTO;
}
