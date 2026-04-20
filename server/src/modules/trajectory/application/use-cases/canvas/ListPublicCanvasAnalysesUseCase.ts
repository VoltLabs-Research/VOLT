import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { extractPluginId } from '@modules/analysis/infrastructure/services/AnalysisPluginDisplayNameService';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { GetAnalysesByTrajectoryIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTrajectoryIdDTO';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { IUseCase } from '@shared/application/IUseCase';

interface ListPublicCanvasAnalysesInput {
    trajectoryId: string;
    userId?: string;
    page?: number;
    limit?: number;
};

@injectable()
export class ListPublicCanvasAnalysesUseCase implements IUseCase<
    ListPublicCanvasAnalysesInput,
    GetAnalysesByTrajectoryIdOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository
    ) {}

    async execute(input: ListPublicCanvasAnalysesInput): Promise<Result<GetAnalysesByTrajectoryIdOutputDTO, ApplicationError>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

            const analyses = await this.analysisRepository.findAll({
                filter: {
                    trajectory: input.trajectoryId
                },
                populate: [
                    { path: 'trajectory', select: ['name'] },
                    { path: 'plugin' }
                ],
                page: input.page,
                limit: input.limit,
                sort: {
                    createdAt: -1
                }
            });

            const data = analyses.data.map((analysis) => {
                const props = { ...analysis.props };
                const pluginValue = props.plugin;
                const pluginId = extractPluginId(pluginValue);

                return {
                    ...props,
                    _id: analysis._id,
                    plugin: pluginId
                };
            });

            return Result.ok({
                ...analyses,
                data
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
