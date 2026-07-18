/**
 * Neutral, cross-module port for the get-plugin-exposure-export use case.
 *
 * Extracted during the detachable-modules migration: the trajectory module's
 * `DownloadTrajectoryAnalysesUseCase` injects the concrete plugin
 * `GetPluginExposureExportUseCase` only to call `.execute(...)`. Depending on
 * this port (resolved via `PLUGIN_USECASE_TOKENS.GetPluginExposureExportUseCase`,
 * same `Symbol.for('GetPluginExposureExportUseCase')` key) lets trajectory avoid
 * importing `@modules/plugin`. The concrete use case implements this port and is
 * dual-registered (`@Singleton()` + `@AliasOf(token)`) so existing by-class
 * resolution keeps working unchanged.
 */
import type {
    GetPluginExposureExportInputDTO,
    GetPluginExposureExportOutputDTO
} from '@shared/contracts/dtos/GetPluginExposureExportDTO';

export interface IGetPluginExposureExportUseCase {
    execute(
        input: GetPluginExposureExportInputDTO
    ): Promise<GetPluginExposureExportOutputDTO>;
}
