import { Result } from '@shared/domain/port/Result';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { ANALYSIS_TOKENS } from '@modules/analysis/application/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTeamIdDTO';
import AnalysisPluginDisplayNameService from '@modules/analysis/application/services/AnalysisPluginDisplayNameService';

@injectable()
export default class GetAnalysesByTeamIdUseCase implements IUseCase<GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository,

        @inject(AnalysisPluginDisplayNameService)
        private readonly pluginDisplayNameService: AnalysisPluginDisplayNameService
    ){}

    async execute(input: GetAnalysesByTeamIdInputDTO): Promise<Result<GetAnalysesByTeamIdOutputDTO, ApplicationError>> {
        const { teamId } = input;
        const results = await this.analysisRepo.findAll({
            filter: { team: teamId },
            populate: [
                {
                    path: 'trajectory',
                    select: ['name']
                },
                {
                    path: 'plugin'
                }
            ],
            sort: { createdAt: -1 },
            limit: input.limit,
            page: input.page
        });

        const data = await Promise.all(results.data.map(async (analysis) => {
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
            ...results,
            data
        });
    }
}
