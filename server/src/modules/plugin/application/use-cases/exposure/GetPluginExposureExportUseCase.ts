import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { inject } from 'tsyringe';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    GetPluginExposureExportInputDTO,
    GetPluginExposureExportOutputDTO
} from '@modules/plugin/application/dtos/exposure/GetPluginExposureExportDTO';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';

import type { IUseCase } from '@shared/application/IUseCase';

import type { IPluginExposureExportService } from '@modules/plugin/domain/port/exposure/IPluginExposureExportService';

@Singleton()
export class GetPluginExposureExportUseCase implements IUseCase<
    GetPluginExposureExportInputDTO,
    GetPluginExposureExportOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(PLUGIN_TOKENS.PluginRepository) private readonly pluginRepository: PluginRepository,
        @inject(PLUGIN_TOKENS.PluginExposureExportService) private readonly pluginExposureExportService: IPluginExposureExportService
    ) {}

    async execute(
        input: GetPluginExposureExportInputDTO
    ): Promise<Result<GetPluginExposureExportOutputDTO, ApplicationError>> {
        const analysis = await this.analysisRepository.findById(String(input.analysisId));

        if (!analysis) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                ErrorCodes.ANALYSIS_NOT_FOUND
            ));
        }

        if (String(analysis.props.team) !== String(input.teamId)) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                ErrorCodes.ANALYSIS_NOT_FOUND
            ));
        }

        const pluginId = String(analysis.props.plugin);
        const plugin = await this.pluginRepository.findById(pluginId);
        let pluginName = pluginId;

        if (plugin?.props?.modifier?.name) {
            pluginName = plugin.props.modifier.name;
        }

        try {
            return Result.ok(await this.pluginExposureExportService.exportAnalysisExposureBundle({
                analysisId: String(input.analysisId),
                trajectoryId: String(analysis.props.trajectory),
                pluginName
            }));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            throw error;
        }
    }
}
