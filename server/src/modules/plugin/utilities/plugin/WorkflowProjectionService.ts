import { ArgumentDefinition } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';
import { ExportNodeData } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ExportNode';
import { ModifierNodeData } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ModifierNode';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import Workflow from '@modules/plugin/domain/entities/plugin/workflow/Workflow';

interface ComputedExposure {
    _id: string;
    name: string;
    results: string;
    icon?: string;
    hasListing: boolean;
    export: ExportNodeData | null;
}

interface ListingExposureEntry {
    exposureId: string;
    name: string;
}

interface ListingExposuresData {
    pluginName: string;
    pluginId: string;
    exposures: ListingExposureEntry[];
}

export interface PluginProjection {
    modifier: ModifierNodeData | null;
    exposures: ComputedExposure[];
    arguments: ArgumentDefinition[];
    listingExposures: ListingExposuresData | null;
}

export default class WorkflowProjectionService {
    static project(workflow: Workflow, pluginId: string): PluginProjection {
        const nodes = workflow.props.nodes;

        const modifierNode = nodes.find((n) => n.type === WorkflowNodeType.Modifier);
        const modifier = modifierNode?.data?.modifier ?? null;

        const exposureNodes = nodes.filter((n) => n.type === WorkflowNodeType.Exposure);

        const exposures: ComputedExposure[] = exposureNodes.map((exposureNode) => {
            const exportNode = workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Export);
            const exposure = exposureNode.data.exposure;

            return {
                _id: exposureNode.id,
                export: exportNode?.data.export ?? null,
                name: exposure?.name ?? '',
                icon: exposure?.icon,
                results: exposure?.results ?? '',
                hasListing: exposure?.hasListing !== false
            };
        });

        const argumentsNode = nodes.find((n) => n.type === WorkflowNodeType.Arguments);
        const args: ArgumentDefinition[] = argumentsNode?.data.arguments?.arguments ?? [];

        const listingEntries = exposures
            .filter((exposure) => exposure.hasListing !== false)
            .map((exposure) => ({
                exposureId: exposure._id,
                name: exposure.name
            }));

        let listingExposures: ListingExposuresData | null = null;
        if (modifier && pluginId) {
            listingExposures = {
                pluginName: modifier.name,
                pluginId,
                exposures: listingEntries
            };
        }

        return {
            modifier,
            exposures,
            arguments: args,
            listingExposures
        };
    }
}
