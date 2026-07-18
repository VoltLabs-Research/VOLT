import { Singleton, AliasOf } from '@shared/infrastructure/di/decorators';
import { PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens/PluginUseCaseTokens';
import type { IGetPluginExposureExportUseCase } from '@shared/contracts/ports/IGetPluginExposureExportUseCase';
import type { GetPluginExposureExportInputDTO, GetPluginExposureExportOutputDTO } from '@shared/contracts/dtos/GetPluginExposureExportDTO';
import PluginService from '@modules/plugin/services/PluginService';

/**
 * Thin cross-module delegator, KEPT so the trajectory module's
 * `DownloadTrajectoryAnalysesUseCase` keeps resolving
 * `PLUGIN_USECASE_TOKENS.GetPluginExposureExportUseCase` without importing
 * `@modules/plugin`. All logic now lives in {@link PluginService.getPluginExposureExport}.
 */
@Singleton()
@AliasOf(PLUGIN_USECASE_TOKENS.GetPluginExposureExportUseCase)
export class GetPluginExposureExportUseCase implements IGetPluginExposureExportUseCase {
    #service = new PluginService();

    execute(input: GetPluginExposureExportInputDTO): Promise<GetPluginExposureExportOutputDTO> {
        return this.#service.getPluginExposureExport(input);
    }
}
