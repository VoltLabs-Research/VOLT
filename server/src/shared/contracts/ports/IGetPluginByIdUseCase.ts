/**
 * Neutral, cross-module port for the get-plugin-by-id use case.
 *
 * Extracted during the detachable-modules migration: the trajectory module's
 * `GetPublicCanvasPluginUseCase` injects the concrete plugin `GetPluginByIdUseCase`
 * only to call `.execute(...)`. Depending on this port (resolved via
 * `PLUGIN_USECASE_TOKENS.GetPluginByIdUseCase`, same `Symbol.for('GetPluginByIdUseCase')`
 * key) lets trajectory avoid importing `@modules/plugin`. The concrete use case
 * implements this port and is dual-registered (`@Singleton()` + `@AliasOf(token)`)
 * so existing by-class resolution keeps working unchanged.
 */
import type {
    GetPluginByIdInputDTO,
    GetPluginByIdOutputDTO
} from '@shared/contracts/dtos/GetPluginByIdDTO';

export interface IGetPluginByIdUseCase {
    execute(
        input: GetPluginByIdInputDTO
    ): Promise<GetPluginByIdOutputDTO>;
}
