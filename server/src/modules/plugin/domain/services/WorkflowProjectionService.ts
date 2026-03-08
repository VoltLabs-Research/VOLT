import { ModifierNodeData } from '../entities/workflow/nodes/ModifierNode';
import { ArgumentDefinition } from '../entities/workflow/nodes/ArgumentNode';
import { ExportNodeData } from '../entities/workflow/nodes/ExportNode';
import Workflow from '../entities/workflow/Workflow';
import { WorkflowNodeType } from '../entities/workflow/WorkflowNode';

interface ComputedExposure {
    _id: string;
    name: string;
    results: string;
    iterable?: string;
    iterableChunkSize?: number;
    icon?: string;
    canvas: boolean;
    raster: boolean;
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

            const exposureData = exposureNode.data.exposure || {} as Record<string, unknown>;
            const { _id: _, id: __, ...cleanedExposureData } = exposureData as Record<string, unknown>;

            const exportData = exportNode?.data.export || {} as Record<string, unknown>;
            const { _id: _e, id: __e, ...cleanedExportData } = exportData as Record<string, unknown>;

            return {
                _id: exposureNode.id,
                export: Object.keys(cleanedExportData).length > 0 ? cleanedExportData : null,
                ...cleanedExposureData,
                canvas: Boolean(exposureData.canvas),
                raster: Boolean(exposureData.raster),
                hasListing: true
            } as ComputedExposure;
        });

        const argumentsNode = nodes.find((n) => n.type === WorkflowNodeType.Arguments);
        const args: ArgumentDefinition[] = argumentsNode?.data.arguments?.arguments ?? [];

        const listingEntries = exposures.map((exposure) => ({
            exposureId: exposure._id,
            name: exposure.name
        }));

        const listingExposures: ListingExposuresData | null = modifier && pluginId
            ? {
                pluginName: modifier.name,
                pluginId,
                exposures: listingEntries
            }
            : null;

        return {
            modifier,
            exposures,
            arguments: args,
            listingExposures
        };
    }
}
