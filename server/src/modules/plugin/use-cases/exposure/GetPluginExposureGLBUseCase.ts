import { Singleton, AliasOf } from '@shared/infrastructure/di/decorators';
import { PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens/PluginUseCaseTokens';
import type { IGetPluginExposureGLBUseCase } from '@shared/contracts/ports/IGetPluginExposureGLBUseCase';
import type { GetPluginExposureGLBInputDTO, GetPluginExposureGLBOutputDTO } from '@shared/contracts/dtos/GetPluginExposureGLBDTO';
import PluginService from '@modules/plugin/services/PluginService';

/**
 * Thin cross-module delegator, KEPT so the trajectory module's
 * `GetPublicCanvasPluginExposureGLBUseCase` keeps resolving
 * `PLUGIN_USECASE_TOKENS.GetPluginExposureGLBUseCase` without importing
 * `@modules/plugin`. All logic now lives in {@link PluginService.getPluginExposureGLB}.
 */
@Singleton()
@AliasOf(PLUGIN_USECASE_TOKENS.GetPluginExposureGLBUseCase)
export class GetPluginExposureGLBUseCase implements IGetPluginExposureGLBUseCase {
    #service = new PluginService();

    execute(input: GetPluginExposureGLBInputDTO): Promise<GetPluginExposureGLBOutputDTO> {
        return this.#service.getPluginExposureGLB(input);
    }
}
