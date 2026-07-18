import { Singleton, AliasOf } from '@shared/infrastructure/di/decorators';
import { PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens/PluginUseCaseTokens';
import type { IGetPluginByIdUseCase } from '@shared/contracts/ports/IGetPluginByIdUseCase';
import type { GetPluginByIdInputDTO, GetPluginByIdOutputDTO } from '@shared/contracts/dtos/GetPluginByIdDTO';
import PluginService from '@modules/plugin/services/PluginService';

/**
 * Thin cross-module delegator. The plugin module was collapsed to a single
 * {@link PluginService} that folds every former use case's logic directly, but
 * this class is KEPT — reduced to a one-line forward — because the trajectory
 * module's `GetPublicCanvasPluginUseCase` resolves it via the neutral
 * `PLUGIN_USECASE_TOKENS.GetPluginByIdUseCase` token (see
 * `IGetPluginByIdUseCase`) without importing `@modules/plugin`.
 */
@Singleton()
@AliasOf(PLUGIN_USECASE_TOKENS.GetPluginByIdUseCase)
export class GetPluginByIdUseCase implements IGetPluginByIdUseCase {
    #service = new PluginService();

    execute(input: GetPluginByIdInputDTO): Promise<GetPluginByIdOutputDTO> {
        return this.#service.getPluginById(input);
    }
}
