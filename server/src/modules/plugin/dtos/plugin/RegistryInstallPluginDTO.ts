import type { PersistedPluginDTO } from '@modules/plugin/dtos/plugin/PersistedPluginDTO';

export interface RegistryInstallPluginInputDTO {
    teamId: string;
    name: string;
    version?: string;
}

export interface RegistryInstallPluginOutputDTO extends PersistedPluginDTO { };
