/**
 * Neutral, cross-module port for the get-plugin-exposure-GLB use case.
 *
 * Extracted during the detachable-modules migration: the trajectory module's
 * `GetPublicCanvasPluginExposureGLBUseCase` injects the concrete plugin
 * `GetPluginExposureGLBUseCase` only to call `.execute(...)`. Depending on this
 * port (resolved via `PLUGIN_USECASE_TOKENS.GetPluginExposureGLBUseCase`, same
 * `Symbol.for('GetPluginExposureGLBUseCase')` key) lets trajectory avoid
 * importing `@modules/plugin`. The concrete use case implements this port and is
 * dual-registered (`@Singleton()` + `@AliasOf(token)`) so existing by-class
 * resolution keeps working unchanged.
 */
import type {
    GetPluginExposureGLBInputDTO,
    GetPluginExposureGLBOutputDTO
} from '@shared/contracts/dtos/GetPluginExposureGLBDTO';

export interface IGetPluginExposureGLBUseCase {
    execute(
        input: GetPluginExposureGLBInputDTO
    ): Promise<GetPluginExposureGLBOutputDTO>;
}
