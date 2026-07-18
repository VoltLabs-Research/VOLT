/**
 * Neutral, cross-module DTO contract for the get-plugin-by-id use case.
 *
 * Extracted from `@modules/plugin/dtos/plugin/GetPluginByIdDTO`
 * during the detachable-modules migration: the trajectory module's
 * `GetPublicCanvasPluginUseCase` consumes `GetPluginByIdOutputDTO` (and the
 * `IGetPluginByIdUseCase` port returns it). The output binds the generic
 * `PersistedPluginDTO` to the neutral structural plugin shapes, so it carries
 * no `@modules/*` coupling. The owner DTO file re-exports these so existing
 * importers compile unchanged. Pure types — no runtime footprint.
 */
import type { PersistedPluginDTO } from '@shared/contracts/dtos/PersistedPluginDTO';
import type { PluginProps, WorkflowPropsLike } from '@shared/contracts/types/Plugin';

export interface GetPluginByIdInputDTO {
    pluginId: string;
}

export type GetPluginByIdOutputDTO = PersistedPluginDTO<PluginProps, WorkflowPropsLike>;
