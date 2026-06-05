import { GetAnalysesByTrajectoryIdInputDTO, GetAnalysesByTrajectoryIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTrajectoryIdDTO';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { extractPluginId } from '@modules/analysis/utilities/extract-plugin-id';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { TRAJECTORY_POPULATE } from '@shared/application/PopulatePresets';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

interface TrajectoryAnalysesFilter extends Partial<AnalysisProps> {
    trajectory: string;
    team?: string;
}

interface AnalysisSort extends Record<string, 1 | -1> {
    createdAt: -1;
}

@injectable()
export class GetAnalysesByTrajectoryIdUseCase implements IUseCase<GetAnalysesByTrajectoryIdInputDTO, GetAnalysesByTrajectoryIdOutputDTO, ApplicationError> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository
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
                TRAJECTORY_POPULATE,
                { path: 'plugin' }
            ],
            page: input.page,
            limit: input.limit,
            sort
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
    }
}
