import { GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTeamIdDTO';
import type { Analysis, AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { extractPluginId } from '@modules/analysis/utilities/extract-plugin-id';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import {
    COMPUTE_CLUSTER_POPULATE,
    STORAGE_CLUSTER_POPULATE,
    TRAJECTORY_POPULATE,
    USER_POPULATE
} from '@shared/application/PopulatePresets';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

interface TeamAnalysesFilter extends Partial<AnalysisProps> {
    team: string;
}

interface AnalysisSort extends Record<string, 1 | -1> {
    createdAt: -1;
}

@injectable()
export default class GetAnalysesByTeamIdUseCase implements IUseCase<GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepo: IAnalysisRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly trajectoryRepo: ITrajectoryRepository
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
            COMPUTE_CLUSTER_POPULATE,
            STORAGE_CLUSTER_POPULATE,
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

        const mappedData = results.data.map((analysis: Analysis) => {
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
                computeClusterId: props.computeClusterId,
                storageClusterId: props.storageClusterId,
                createdBy: props.createdBy,
                trajectoryName
            };
        });

        return Result.ok({
            ...results,
            data: mappedData
        });
    }
}
