import type { PersistedPluginDTO } from '@modules/plugin/application/dtos/plugin/PersistedPluginDTO';

export interface ImportPluginInputDTO {
    file: any;
    teamId: string;
}

export interface ImportPluginOutputDTO extends PersistedPluginDTO { }
