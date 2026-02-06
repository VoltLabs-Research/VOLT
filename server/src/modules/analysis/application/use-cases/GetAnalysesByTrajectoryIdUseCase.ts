import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { GetAnalysesByTrajectoryIdInputDTO, GetAnalysesByTrajectoryIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysesByTrajectoryIdDTO';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
import Workflow from '@modules/plugin/domain/entities/workflow/Workflow';

@injectable()
export class GetAnalysesByTrajectoryIdUseCase implements IUseCase<GetAnalysesByTrajectoryIdInputDTO, GetAnalysesByTrajectoryIdOutputDTO, ApplicationError> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository
    ) {}

    async execute(input: GetAnalysesByTrajectoryIdInputDTO): Promise<Result<GetAnalysesByTrajectoryIdOutputDTO, ApplicationError>> {
        const analyses = await this.analysisRepository.findAll({
            filter: { trajectory: input.trajectoryId },
            populate: 'plugin',
            page: 1, 
            limit: 100
        });

        // DUPLICATED CODE
        const data = analyses.data.map((analysis: any) => {
            const props = { ...analysis.props };
            props._id = analysis.id;

            // Enrich plugin if populated
            if (props.plugin && typeof props.plugin === 'object') {
                const plugin = props.plugin as any;
                
                // Keep the object for the frontend, but ensure derived fields are present
                if (plugin.workflow && plugin.workflow.nodes) {
                    const nodes = plugin.workflow.nodes;
                    const edges = plugin.workflow.edges || [];

                    // 1. Modifier
                    const modifierNode = nodes.find((n: any) => n.type === WorkflowNodeType.Modifier);
                    if (modifierNode) {
                        plugin.modifier = modifierNode.data.modifier;
                    }

                    const workflow = new Workflow('', plugin.workflow);

                    // 2. Exposures
                    const exposureNodes = nodes.filter((n: any) => n.type === WorkflowNodeType.Exposure);
                    plugin.exposures = exposureNodes.map((exposureNode: any) => {
                        const visualizersNode = workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Visualizers);
                        const exportNode = workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Export);
                        return {
                            _id: exposureNode.id,
                            exportData: exportNode?.data?.export,
                            ...exposureNode.data.exposure,
                            ...visualizersNode?.data?.visualizers
                        };
                    });

                    // 3. Arguments
                    const argumentsNode = nodes.find((n: any) => n.type === WorkflowNodeType.Arguments);
                    plugin.arguments = argumentsNode?.data?.arguments?.arguments ?? [];

                    // 4. Listing Exposures
                    const listingExposures = plugin.exposures
                        .filter((exp: any) => (
                            (exp.listing && Object.keys(exp.listing).length > 0) ||
                            (exp.perAtomProperties && exp.perAtomProperties.length > 0)
                        ))
                        .map((exp: any) => ({
                            name: exp.name,
                            slug: exp.slug,
                            hasPerAtomProperties: Boolean(exp.perAtomProperties?.length)
                        }));
                    
                    plugin.listingExposures = {
                        pluginName: plugin.modifier?.name,
                        pluginSlug: plugin.slug,
                        exposures: listingExposures
                    };
                }
            }
            return props;
        });

        return Result.ok({
            ...analyses,
            data
        });
    }
}
