import { ModifierNodeData } from '../entities/workflow/nodes/ModifierNode';
import { ArgumentDefinition } from '../entities/workflow/nodes/ArgumentNode';
import { ExportNodeData } from '../entities/workflow/nodes/ExportNode';
import Workflow from '../entities/workflow/Workflow';
import { WorkflowNodeType } from '../entities/workflow/WorkflowNode';

export interface ComputedExposure {
    _id: string;
    name: string;
    results: string;
    iterable?: string;
    iterableChunkSize?: number;
    icon?: string;
    canvas: boolean;
    raster: boolean;
    perAtomProperties: string[];
    listing: Record<string, string> | null;
    listingTitle: string;
    export: ExportNodeData | null;
}

export interface ListingExposureEntry {
    exposureId: string;
    name: string;
    hasPerAtomProperties: boolean;
}

export interface ListingExposuresData {
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

        // 1. Modifier
        const modifierNode = nodes.find((n) => n.type === WorkflowNodeType.Modifier);
        const modifier = modifierNode?.data?.modifier ?? null;

        // 2. Exposures
        const exposureNodes = nodes.filter((n) => n.type === WorkflowNodeType.Exposure);
        const exposures: ComputedExposure[] = exposureNodes.map((exposureNode) => {
            const visualizersNode = workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Visualizers);
            const exportNode = workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Export);

            const exposureData = exposureNode.data.exposure || {} as any;
            const { _id: _, id: __, ...cleanedExposureData } = exposureData as any;

            const visualizersData = visualizersNode?.data.visualizers || {} as any;
            const { _id: _v, id: __v, ...cleanedVisualizersData } = visualizersData as any;

            const exportData = exportNode?.data.export || {} as any;
            const { _id: _e, id: __e, ...cleanedExportData } = exportData as any;

            return {
                _id: exposureNode.id,
                export: Object.keys(cleanedExportData).length > 0 ? cleanedExportData : null,
                ...cleanedExposureData,
                ...cleanedVisualizersData
            };
        });

        // 3. Arguments
        const argumentsNode = nodes.find((n) => n.type === WorkflowNodeType.Arguments);
        const args: ArgumentDefinition[] = argumentsNode?.data.arguments?.arguments ?? [];

        // 4. Listing Exposures
        const listingEntries = exposures
            .filter((exp) => exp.listing && Object.keys(exp.listing).length > 0)
            .map((exp) => ({
                exposureId: exp._id,
                name: exp.name,
                hasPerAtomProperties: Boolean(exp.perAtomProperties?.length)
            }));

        const listingExposures: ListingExposuresData | null = modifier
            ? {
                pluginName: modifier.name,
                pluginId,
                exposures: listingEntries
            }
            : null;

        return { modifier, exposures, arguments: args, listingExposures };
    }
}
