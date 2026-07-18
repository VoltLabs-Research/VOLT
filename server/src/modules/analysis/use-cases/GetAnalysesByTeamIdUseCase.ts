import { GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO } from '@modules/analysis/dtos/GetAnalysesByTeamIdDTO';
import type { Analysis, AnalysisProps } from '@modules/analysis/entities/Analysis';
import type { IAnalysisRepository } from '@modules/analysis/ports/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/di/AnalysisTokens';
import { extractPluginId } from '@shared/application/utilities/extract-plugin-id';
import type { ITrajectoryRepository } from '@shared/contracts/ports';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type { IUseCase } from '@shared/application/IUseCase';
import {
    COMPUTE_CLUSTER_POPULATE,
    STORAGE_CLUSTER_POPULATE,
    TRAJECTORY_POPULATE,
    USER_POPULATE
} from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import { inject, injectable } from 'tsyringe';

interface TeamAnalysesFilter extends Partial<AnalysisProps> {
    team: string;
}

@injectable()
export default class GetAnalysesByTeamIdUseCase implements IUseCase<GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepo: IAnalysisRepository,
        @inject(COMPUTE_TOKENS.TrajectoryRepository) private readonly trajectoryRepo: ITrajectoryRepository
    ) {}

    async execute(input: GetAnalysesByTeamIdInputDTO): Promise<GetAnalysesByTeamIdOutputDTO> {
        const { teamId } = input;
        const normalizedSearch = input.search?.trim();
        const hasSearch = Boolean(normalizedSearch);
        const filter: TeamAnalysesFilter = {
            team: teamId
        };

        const sort = {
            createdAt: -1
        } as const;

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

        return {
            ...results,
            data: mappedData
        };
    }
}
