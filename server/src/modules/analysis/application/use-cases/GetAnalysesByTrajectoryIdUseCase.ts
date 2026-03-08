import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { GetAnalysesByTrajectoryIdInputDTO, GetAnalysesByTrajectoryIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTrajectoryIdDTO';
import AnalysisPluginDisplayNameService, { extractPluginId } from '@modules/analysis/infrastructure/services/AnalysisPluginDisplayNameService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';

interface TrajectoryAnalysesFilter extends Partial<AnalysisProps> {
    trajectory: string;
    team?: string;
};

interface AnalysisSort extends Record<string, 1 | -1> {
    createdAt: -1;
};

@injectable()
export class GetAnalysesByTrajectoryIdUseCase implements IUseCase<GetAnalysesByTrajectoryIdInputDTO, GetAnalysesByTrajectoryIdOutputDTO, ApplicationError> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(AnalysisPluginDisplayNameService)
        private readonly pluginDisplayNameService: AnalysisPluginDisplayNameService
    ) {}

    async execute(input: GetAnalysesByTrajectoryIdInputDTO): Promise<Result<GetAnalysesByTrajectoryIdOutputDTO, ApplicationError>> {
        const filter: TrajectoryAnalysesFilter = {
            trajectory: input.trajectoryId
        };
        const sort: AnalysisSort = {
            createdAt: -1
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
            sort
        });

        const data = await Promise.all(analyses.data.map(async (analysis) => {
            const props = { ...analysis.props };
            const pluginValue = props.plugin;
            const pluginId = extractPluginId(pluginValue);
            const pluginDisplayName = await this.pluginDisplayNameService.resolveModifierName(pluginValue);

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
};
