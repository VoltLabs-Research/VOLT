import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTeamIdDTO';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export default class GetAnalysesByTeamIdUseCase implements IUseCase<GetAnalysesByTeamIdInputDTO, GetAnalysesByTeamIdOutputDTO, ApplicationError> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository,

        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
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

        const pluginNameCache = new Map<string, string>();

        const resolveModifierName = async (pluginValue: any): Promise<string> => {
            const directNodes = pluginValue?.props?.workflow?.props?.nodes || pluginValue?.workflow?.props?.nodes || [];
            if (Array.isArray(directNodes)) {
                const directModifier = directNodes.find((node: any) => node?.type === WorkflowNodeType.Modifier);
                const directName = typeof directModifier?.data?.modifier?.name === 'string'
                    ? directModifier.data.modifier.name.trim()
                    : '';
                if (directName) return directName;
            }

            const pluginId = typeof pluginValue === 'string'
                ? pluginValue
                : String(pluginValue?._id || pluginValue?.id || '');

            if (!pluginId) return '';
            if (pluginNameCache.has(pluginId)) return pluginNameCache.get(pluginId)!;

            const pluginById = await this.pluginRepository.findById(pluginId);
            const nodes = pluginById?.props?.workflow?.props?.nodes || [];
            const modifierNode = Array.isArray(nodes)
                ? nodes.find((node: any) => node?.type === WorkflowNodeType.Modifier)
                : undefined;
            const modifierName = typeof modifierNode?.data?.modifier?.name === 'string'
                ? modifierNode.data.modifier.name.trim()
                : '';

            pluginNameCache.set(pluginId, modifierName);
            return modifierName;
        };

        const data = await Promise.all(results.data.map(async (analysis: any) => {
            const props = { ...analysis.props };
            const pluginValue = props.plugin;
            const pluginId = typeof pluginValue === 'string'
                ? pluginValue
                : String(pluginValue?._id || pluginValue?.id || '');
            const pluginDisplayName = await resolveModifierName(pluginValue);

            return {
                ...props,
                _id: analysis.id,
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
