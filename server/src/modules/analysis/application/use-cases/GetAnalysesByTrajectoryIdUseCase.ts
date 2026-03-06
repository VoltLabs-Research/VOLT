import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { GetAnalysesByTrajectoryIdInputDTO, GetAnalysesByTrajectoryIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTrajectoryIdDTO';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';


@injectable()
export class GetAnalysesByTrajectoryIdUseCase implements IUseCase<GetAnalysesByTrajectoryIdInputDTO, GetAnalysesByTrajectoryIdOutputDTO, ApplicationError> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ) {}

    async execute(input: GetAnalysesByTrajectoryIdInputDTO): Promise<Result<GetAnalysesByTrajectoryIdOutputDTO, ApplicationError>> {
        const analyses = await this.analysisRepository.findAll({
            filter: { trajectory: input.trajectoryId },
            populate: 'plugin',
            page: input.page,
            limit: input.limit,
            sort: { createdAt: -1 }
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

        const data = await Promise.all(analyses.data.map(async (analysis: any) => {
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
            ...analyses,
            data
        });
    }
}
