
import type { PersistedPluginDTO } from '@shared/contracts/dtos/PersistedPluginDTO';
import type { PluginProps, WorkflowPropsLike } from '@shared/contracts/types/Plugin';

export interface GetPluginByIdInputDTO {
    pluginId: string;
}

export type GetPluginByIdOutputDTO = PersistedPluginDTO<PluginProps, WorkflowPropsLike>;
