/**
 * Neutral, cross-module port for the get-sub-listing use case.
 *
 * Extracted during the detachable-modules migration: the trajectory module's
 * `GetPublicCanvasSubListingUseCase` injects the concrete plugin
 * `GetSubListingUseCase` only to call `.execute(...)`. Depending on this port
 * (resolved via `PLUGIN_USECASE_TOKENS.GetSubListingUseCase`, same
 * `Symbol.for('GetSubListingUseCase')` key) lets trajectory avoid importing
 * `@modules/plugin`. The concrete use case implements this port and is
 * dual-registered (`@injectable()` + `@AliasOf(token)`, preserving its transient
 * lifecycle) so existing by-class resolution keeps working unchanged.
 */
import type {
    GetSubListingInputDTO,
    GetSubListingOutputDTO
} from '@shared/contracts/dtos/GetSubListingDTO';

export interface IGetSubListingUseCase {
    execute(
        input: GetSubListingInputDTO
    ): Promise<GetSubListingOutputDTO>;
}
