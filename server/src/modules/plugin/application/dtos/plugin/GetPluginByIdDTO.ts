/**
 * Re-export shim. The canonical get-plugin-by-id DTOs now live in the neutral
 * `@shared/contracts/dtos/GetPluginByIdDTO` (detachable-modules migration). The
 * output binds the generic `PersistedPluginDTO` to the neutral structural plugin
 * shapes; the owner module's concrete `Plugin` → `PersistedPluginDTO` mapping is
 * structurally assignable to it, so the owner use case compiles unchanged.
 * Existing `@modules/plugin/application/dtos/plugin/GetPluginByIdDTO` importers
 * keep working unchanged.
 */
export type {
    GetPluginByIdInputDTO,
    GetPluginByIdOutputDTO
} from '@shared/contracts/dtos/GetPluginByIdDTO';
