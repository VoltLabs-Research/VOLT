import {
    GetPluginExposureExportInputDTO,
    GetPluginExposureExportOutputDTO
} from '@modules/plugin/application/dtos/exposure/GetPluginExposureExportDTO';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';

import type { IUseCase } from '@shared/application/IUseCase';

import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import { PluginExposureExportService } from '@modules/plugin/infrastructure/services/exposure/PluginExposureExportService';

@Singleton()
export class GetPluginExposureExportUseCase implements IUseCase<
    GetPluginExposureExportInputDTO,
    GetPluginExposureExportOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly analysisRepository: AnalysisRepository,
        
        private readonly pluginRepository: PluginRepository,
        
        private readonly pluginExposureExportService: PluginExposureExportService
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
};
