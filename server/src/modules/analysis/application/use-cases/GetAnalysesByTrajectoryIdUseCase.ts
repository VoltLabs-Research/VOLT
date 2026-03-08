import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { GetAnalysesByTrajectoryIdInputDTO, GetAnalysesByTrajectoryIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTrajectoryIdDTO';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/application/di/AnalysisTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import AnalysisPluginDisplayNameService from '@modules/analysis/application/services/AnalysisPluginDisplayNameService';

@injectable()
export class GetAnalysesByTrajectoryIdUseCase implements IUseCase<GetAnalysesByTrajectoryIdInputDTO, GetAnalysesByTrajectoryIdOutputDTO, ApplicationError> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(AnalysisPluginDisplayNameService)
        private readonly pluginDisplayNameService: AnalysisPluginDisplayNameService
    ) {}

    async execute(input: GetAnalysesByTrajectoryIdInputDTO): Promise<Result<GetAnalysesByTrajectoryIdOutputDTO, ApplicationError>> {
        const filter: Record<string, unknown> = {
            trajectory: input.trajectoryId
        };

        if (input.teamId) {
            filter.team = input.teamId;
        }

        const analyses = await this.analysisRepository.findAll({
            filter,
            populate: [
                { path: 'trajectory', select: ['name'] },
                { path: 'plugin' }
            ],
            page: input.page,
            limit: input.limit,
            sort: { createdAt: -1 }
        });

        const data = await Promise.all(analyses.data.map(async (analysis) => {
            const props = { ...analysis.props };
            const pluginValue = props.plugin;
            const pluginId = typeof pluginValue === 'string'
                ? pluginValue
                : String((pluginValue as Record<string, unknown>)?._id || '');
            const pluginDisplayName = await this.pluginDisplayNameService.resolveModifierName(pluginValue as string | Record<string, unknown>);

            return {
                ...props,
                _id: analysis._id,
                plugin: pluginId,
                pluginDisplayName
            };
        }));

        return Result.ok({
            ...analyses,
            data
        });
    }
}
