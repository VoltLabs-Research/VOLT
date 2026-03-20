import { TRAJECTORY_POPULATE, CLUSTER_POPULATE, USER_POPULATE } from '@shared/application/PopulatePresets';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTeamIdDTO';
import { extractPluginId } from '@modules/analysis/infrastructure/services/AnalysisPluginDisplayNameService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

interface TeamAnalysesFilter extends Partial<AnalysisProps> {
    team: string;
};

interface AnalysisSort extends Record<string, 1 | -1> {
    createdAt: -1;
};

@injectable()
export default class GetAnalysesByTeamIdUseCase implements IUseCase<GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private trajectoryRepo: ITrajectoryRepository
    ) {}

    async execute(input: GetAnalysesByTeamIdInputDTO): Promise<Result<GetAnalysesByTeamIdOutputDTO, ApplicationError>> {
        const { teamId } = input;
        const normalizedSearch = input.search?.trim();
        const hasSearch = Boolean(normalizedSearch);
        const filter: TeamAnalysesFilter = {
            team: teamId
        };

        const sort: AnalysisSort = {
            createdAt: -1
        };

        const populate = [
            TRAJECTORY_POPULATE,
            {
                path: 'plugin'
            },
            CLUSTER_POPULATE,
            USER_POPULATE
        ];
        const results = hasSearch
            ? await this.analysisRepo.findByTeamAndSearch({
                teamId,
                search: normalizedSearch!,
                trajectoryIds: await this.trajectoryRepo.searchIdsByTeamAndName(teamId, normalizedSearch!),
                populate,
                limit: input.limit,
                page: input.page
            })
            : await this.analysisRepo.findAll({
                filter,
                populate,
                sort,
                limit: input.limit,
                page: input.page
            });

        const mappedData = results.data.map((analysis) => {
            const props = { ...analysis.props };
            const pluginValue = props.plugin;
            const pluginId = extractPluginId(pluginValue);
            const trajectoryValue = props.trajectory as { name?: string } | string;
            const trajectoryName = typeof trajectoryValue === 'string'
                ? undefined
                : trajectoryValue?.name;

            return {
                ...props,
                _id: analysis._id,
                plugin: pluginId,
                trajectory: props.trajectory,
                teamCluster: props.teamCluster,
                createdBy: props.createdBy,
                trajectoryName
            };
        });

        return Result.ok({
            ...results,
            data: mappedData
        });
    }
};
