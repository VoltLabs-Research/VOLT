import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { extractPluginId } from '@modules/analysis/utilities/extract-plugin-id';
import type { GetPluginByIdOutputDTO } from '@modules/plugin/application/dtos/plugin/GetPluginByIdDTO';
import { GetPluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/GetPluginByIdUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

interface GetPublicCanvasPluginInput {
    trajectoryId: string;
    pluginId: string;
    userId?: string;
};

@Singleton()
export class GetPublicCanvasPluginUseCase implements IUseCase<
    GetPublicCanvasPluginInput,
    GetPluginByIdOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,

        
        private readonly getPluginByIdUseCase: GetPluginByIdUseCase
    ) {}

    async execute(input: GetPublicCanvasPluginInput): Promise<Result<GetPluginByIdOutputDTO, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const analyses = await this.analysisRepository.findAll({
                filter: { trajectory: input.trajectoryId },
                limit: 1000
            });

            const pluginAttached = analyses.data.some((analysis) => {
                const pluginId = extractPluginId(analysis.props.plugin);
                return pluginId === input.pluginId;
            });

            if (!pluginAttached) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.PLUGIN_NOT_FOUND,
                    'Plugin not found'
                ));
            }

            return this.getPluginByIdUseCase.execute({ pluginId: input.pluginId });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
