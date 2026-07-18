/**
 * Neutral, cross-module port for the get-plugin-listing-documents use case.
 *
 * Extracted during the detachable-modules migration: the trajectory module's
 * `GetPublicCanvasPluginListingUseCase` injects the concrete plugin
 * `GetPluginListingDocumentsUseCase` only to call `.execute(...)`. Depending on
 * this port (resolved via `PLUGIN_USECASE_TOKENS.GetPluginListingDocumentsUseCase`,
 * same `Symbol.for('GetPluginListingDocumentsUseCase')` key) lets trajectory
 * avoid importing `@modules/plugin`. The concrete use case implements this port
 * and is dual-registered (`@injectable()` + `@AliasOf(token)`, preserving its
 * transient lifecycle) so existing by-class resolution keeps working unchanged.
 */
import type {
    GetPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsOutputDTO
} from '@shared/contracts/dtos/GetPluginListingDocumentsDTO';

export interface IGetPluginListingDocumentsUseCase {
    execute(
        input: GetPluginListingDocumentsInputDTO
    ): Promise<GetPluginListingDocumentsOutputDTO>;
}
