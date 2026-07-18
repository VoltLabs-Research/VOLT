import { injectable } from 'tsyringe';
import { AliasOf } from '@shared/infrastructure/di/decorators';
import { PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens/PluginUseCaseTokens';
import type { IGetPluginListingDocumentsUseCase } from '@shared/contracts/ports/IGetPluginListingDocumentsUseCase';
import type {
    GetPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsOutputDTO
} from '@shared/contracts/dtos/GetPluginListingDocumentsDTO';
import PluginService from '@modules/plugin/services/PluginService';

/**
 * Thin cross-module delegator (transient, matching the original lifecycle),
 * KEPT so the trajectory module's `GetPublicCanvasPluginListingUseCase` keeps
 * resolving `PLUGIN_USECASE_TOKENS.GetPluginListingDocumentsUseCase` without
 * importing `@modules/plugin`. All logic now lives in
 * {@link PluginService.getPluginListingDocuments}.
 */
@injectable()
@AliasOf(PLUGIN_USECASE_TOKENS.GetPluginListingDocumentsUseCase)
export class GetPluginListingDocumentsUseCase implements IGetPluginListingDocumentsUseCase {
    #service = new PluginService();

    execute(input: GetPluginListingDocumentsInputDTO): Promise<GetPluginListingDocumentsOutputDTO> {
        return this.#service.getPluginListingDocuments(input);
    }
}
