import type { GetAnalysesByTrajectoryIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTrajectoryIdDTO';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import { extractPluginId } from '@modules/analysis/infrastructure/services/AnalysisPluginDisplayNameService';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

interface ListPublicCanvasAnalysesInput {
    trajectoryId: string;
    userId?: string;
    page?: number;
    limit?: number;
};

@Singleton()
export class ListPublicCanvasAnalysesUseCase implements IUseCase<
    ListPublicCanvasAnalysesInput,
    GetAnalysesByTrajectoryIdOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        private readonly analysisRepository: AnalysisRepository
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
