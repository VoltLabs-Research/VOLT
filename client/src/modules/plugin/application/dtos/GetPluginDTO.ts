import type { Plugin } from '../../domain/entities';

export interface GetPluginInputDTO {
    id: string;
};

export type GetPluginOutputDTO = Plugin;
