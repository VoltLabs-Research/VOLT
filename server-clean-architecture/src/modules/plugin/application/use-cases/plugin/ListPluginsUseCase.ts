import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { ListPluginsInputDTO, ListPluginsOutputDTO } from '@modules/plugin/application/dtos/plugin/ListPluginsDTO';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';

@injectable()
export class ListPluginsUseCase implements IUseCase<ListPluginsInputDTO, ListPluginsOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository
    ){}

    async execute(input: ListPluginsInputDTO): Promise<Result<ListPluginsOutputDTO>> {
        const result = await this.pluginRepository.findAll({
            filter: { team: input.teamId },
            page: 1,
            limit: 100
        });

        // TODO: Ugly. Fix it.
        // TODO: Extra fields like modifier, arguments, and others were previously in Mongoose Virtuals (old server code).
        // TODO: This should be pre-computed upon receiving the workflow and saved along with the model data. 
        // TODO: Recalculating it every time the use case is executed is absurdly ridiculous.
        const data = [];
        for(const plugin of result.data){
            const doc: any = { ...plugin.props };

            // Modifier node data.
            const modifierNode = plugin.props.workflow.props.nodes.find((node) => node.type === WorkflowNodeType.Modifier);
            if(modifierNode) doc.modifier = modifierNode.data.modifier;

            // Exposure and Visualizers nodes data.
            const exposureNodes = plugin.props.workflow.props.nodes.filter((node) => node.type === WorkflowNodeType.Exposure);
            doc.exposures = [];
            for(const exposureNode of exposureNodes){
                // Get the visualization config for the exposure from the visualizers node.
                const visualizersNode = plugin.props.workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Visualizers);
                const exportNode = plugin.props.workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Export);
                doc.exposures.push({
                    _id: exposureNode.id,
                    exportData: exportNode?.data.export,
                    ...exposureNode.data.exposure,
                    ...visualizersNode?.data.visualizers,
                })
            }

            // Get the plugin arguments from the arguments node.
            const argumentsNode = plugin.props.workflow.props.nodes.find((node) => node.type === WorkflowNodeType.Arguments);
            doc.arguments = argumentsNode?.data.arguments?.arguments ?? [];

            // Exposures nodes can have listing config.
            const listingExposures = doc.exposures
                .filter((exposure: any) => (
                    (exposure.listing && Object.keys(exposure.listing).length > 0) ||
                    (exposure.perAtomProperties && exposure.perAtomProperties.length > 0)
                ))
                .map((exposure: any) => ({
                    name: exposure.name,
                    slug: exposure.slug,
                    hasPerAtomProperties: Boolean(exposure.perAtomProperties?.length)
                }));
            
            doc.listingExposures = {
                pluginName: doc.modifier.name,
                pluginSlug: plugin.props.slug,
                exposures: listingExposures
            };

            data.push(doc);
        }

        return Result.ok({
            ...result,
            data
        });
    }
}
