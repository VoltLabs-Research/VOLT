import { ErrorCodes } from '@core/constants/error-codes';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { extractPluginId } from '@modules/analysis/infrastructure/services/AnalysisPluginDisplayNameService';
import { GetPluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/GetPluginByIdUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { GetPluginByIdOutputDTO } from '@modules/plugin/application/dtos/plugin/GetPluginByIdDTO';
import type { IUseCase } from '@shared/application/IUseCase';

interface GetPublicCanvasPluginInput {
    trajectoryId: string;
    pluginId: string;
    userId?: string;
};

@injectable()
export class GetPublicCanvasPluginUseCase implements IUseCase<
    GetPublicCanvasPluginInput,
    GetPluginByIdOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(GetPluginByIdUseCase)
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
