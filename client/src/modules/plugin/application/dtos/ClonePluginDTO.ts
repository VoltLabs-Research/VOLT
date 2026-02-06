import type { Plugin } from '../../domain/entities';

export interface ClonePluginInputDTO {
    pluginId: string;
    teamId?: string;
};

export type ClonePluginOutputDTO = Plugin;
