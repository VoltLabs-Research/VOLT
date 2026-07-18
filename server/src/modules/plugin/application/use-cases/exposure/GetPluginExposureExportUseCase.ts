import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import { inject } from 'tsyringe';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    GetPluginExposureExportInputDTO,
    GetPluginExposureExportOutputDTO
} from '@modules/plugin/application/dtos/exposure/GetPluginExposureExportDTO';
import { Singleton, AliasOf } from '@shared/infrastructure/di/decorators';
import { PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens/PluginUseCaseTokens';
import type { IGetPluginExposureExportUseCase } from '@shared/contracts/ports/IGetPluginExposureExportUseCase';

import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';

import type { IUseCase } from '@shared/application/IUseCase';

import type { IPluginExposureExportService } from '@modules/plugin/domain/port/exposure/IPluginExposureExportService';

@Singleton()
@AliasOf(PLUGIN_USECASE_TOKENS.GetPluginExposureExportUseCase)
export class GetPluginExposureExportUseCase implements IUseCase<GetPluginExposureExportInputDTO, GetPluginExposureExportOutputDTO>, IGetPluginExposureExportUseCase {
    constructor(
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(PLUGIN_TOKENS.PluginRepository) private readonly pluginRepository: IPluginRepository,
        @inject(PLUGIN_TOKENS.PluginExposureExportService) private readonly pluginExposureExportService: IPluginExposureExportService
    ) {}

    async execute(
        input: GetPluginExposureExportInputDTO
    ): Promise<GetPluginExposureExportOutputDTO> {
        const analysis = await this.analysisRepository.findById(String(input.analysisId));

        if (!analysis) {
            throw ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                ErrorCodes.ANALYSIS_NOT_FOUND
            );
        }

        if (String(analysis.props.team) !== String(input.teamId)) {
            throw ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                ErrorCodes.ANALYSIS_NOT_FOUND
            );
        }

        const pluginId = String(analysis.props.plugin);
        const plugin = await this.pluginRepository.findById(pluginId);
        let pluginName = pluginId;

        if (plugin?.props?.modifier?.name) {
            pluginName = plugin.props.modifier.name;
        }

        try {
            return await this.pluginExposureExportService.exportAnalysisExposureBundle({
                analysisId: String(input.analysisId),
                trajectoryId: String(analysis.props.trajectory),
                pluginName
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw error;
        }
    }
}
