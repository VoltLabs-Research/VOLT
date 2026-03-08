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

@injectable()
export default class GetAnalysesByTeamIdUseCase implements IUseCase<GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository,

        @inject(AnalysisPluginDisplayNameService)
        private readonly pluginDisplayNameService: AnalysisPluginDisplayNameService
    ) {}

    async execute(input: GetAnalysesByTeamIdInputDTO): Promise<Result<GetAnalysesByTeamIdOutputDTO, ApplicationError>> {
        const { teamId } = input;
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
            limit: input.limit,
            page: input.page
        });

        const data = await Promise.all(results.data.map(async (analysis) => {
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
            ...results,
            data
        });
    }
};
