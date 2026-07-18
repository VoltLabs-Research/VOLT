import { injectable } from 'tsyringe';
import { AliasOf } from '@shared/infrastructure/di/decorators';
import { PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens/PluginUseCaseTokens';
import type { IGetSubListingUseCase } from '@shared/contracts/ports/IGetSubListingUseCase';
import type { GetSubListingInputDTO, GetSubListingOutputDTO } from '@shared/contracts/dtos/GetSubListingDTO';
import PluginService from '@modules/plugin/services/PluginService';

/**
 * Thin cross-module delegator (transient, matching the original lifecycle),
 * KEPT so the trajectory module's `GetPublicCanvasSubListingUseCase` keeps
 * resolving `PLUGIN_USECASE_TOKENS.GetSubListingUseCase` without importing
 * `@modules/plugin`. All logic now lives in {@link PluginService.getSubListing}.
 */
@injectable()
@AliasOf(PLUGIN_USECASE_TOKENS.GetSubListingUseCase)
export class GetSubListingUseCase implements IGetSubListingUseCase {
    #service = new PluginService();

    execute(input: GetSubListingInputDTO): Promise<GetSubListingOutputDTO> {
        return this.#service.getSubListing(input);
    }
}
