import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTeamIdDTO';
import AnalysisPluginDisplayNameService, { extractPluginId } from '@modules/analysis/infrastructure/services/AnalysisPluginDisplayNameService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';

interface TeamAnalysesFilter extends Partial<AnalysisProps> {
    team: string;
};

interface AnalysisSort extends Record<string, 1 | -1> {
    createdAt: -1;
};

interface SearchableAnalysisItem {
    _id: string;
    trajectoryName?: string;
    pluginDisplayName?: string;
};

@injectable()
export default class GetAnalysesByTeamIdUseCase implements IUseCase<GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository,

        @inject(AnalysisPluginDisplayNameService)
        private readonly pluginDisplayNameService: AnalysisPluginDisplayNameService
    ) {}

    async execute(input: GetAnalysesByTeamIdInputDTO): Promise<Result<GetAnalysesByTeamIdOutputDTO, ApplicationError>> {
        const { teamId, search } = input;
        const filter: TeamAnalysesFilter = {
            team: teamId
        };

        const sort: AnalysisSort = {
            createdAt: -1
        };

        const results = await this.analysisRepo.findAll({
            filter,
            populate: [
                {
                    path: 'trajectory',
                    select: ['name']
                },
                {
                    path: 'plugin'
                }
            ],
            sort,
            limit: search ? undefined : input.limit,
            page: search ? undefined : input.page
        });

        const mappedData = await Promise.all(results.data.map(async (analysis) => {
            const props = { ...analysis.props };
            const pluginValue = props.plugin;
            const pluginId = extractPluginId(pluginValue);
            const pluginDisplayName = await this.pluginDisplayNameService.resolveModifierName(pluginValue);
            const trajectoryValue = props.trajectory as { name?: string } | string;
            const trajectoryName = typeof trajectoryValue === 'string'
                ? undefined
                : trajectoryValue?.name;

            return {
                ...props,
                _id: analysis._id,
                plugin: pluginId,
                pluginDisplayName,
                trajectoryName
            };
        }));

        if (!search) {
            return Result.ok({
                ...results,
                data: mappedData
            });
        }

        const normalizedSearch = search.trim().toLowerCase();
        const filteredData = mappedData.filter((analysis: SearchableAnalysisItem) => {
            return (analysis.pluginDisplayName?.toLowerCase().includes(normalizedSearch) ?? false)
                || (analysis.trajectoryName?.toLowerCase().includes(normalizedSearch) ?? false)
                || analysis._id.toLowerCase().includes(normalizedSearch);
        });

        const page = input.page ?? 1;
        const limit = input.limit ?? 20;
        const start = (page - 1) * limit;
        const data = filteredData.slice(start, start + limit);
        const total = filteredData.length;
        const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

        return Result.ok({
            total,
            page,
            limit,
            totalPages,
            data
        });
    }
};
