import { ArgumentDefinition } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ArgumentNode';
import { ExportNodeData } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ExportNode';
import { ModifierNodeData } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ModifierNode';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import Workflow from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import { asRecord } from '@shared/infrastructure/utilities/type-guards';

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
};

interface ListingExposureEntry {
    exposureId: string;
    name: string;
};

interface ListingExposuresData {
    pluginName: string;
    pluginId: string;
    exposures: ListingExposureEntry[];
};

export interface PluginProjection {
    modifier: ModifierNodeData | null;
    exposures: ComputedExposure[];
    arguments: ArgumentDefinition[];
    listingExposures: ListingExposuresData | null;
};

const toExposureData = (value: unknown): Record<string, unknown> => {
    return asRecord(value) || {};
};

const toExportData = (value: unknown): ExportNodeData | null => {
    const record = asRecord(value);
    if (!record) {
        return null;
    }

    return record as unknown as ExportNodeData;
};

export default class WorkflowProjectionService {
    static project(workflow: Workflow, pluginId: string): PluginProjection {
        const nodes = workflow.props.nodes;

        const modifierNode = nodes.find((n) => n.type === WorkflowNodeType.Modifier);
        const modifier = modifierNode?.data?.modifier ?? null;

        const exposureNodes = nodes.filter((n) => n.type === WorkflowNodeType.Exposure);

        const exposures: ComputedExposure[] = exposureNodes.map((exposureNode) => {
            const exportNode = workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Export);

            const exposureData = toExposureData(exposureNode.data.exposure);
            const { _id: _, id: __, ...cleanedExposureData } = exposureData;

            const exportData = toExportData(exportNode?.data.export);

            return {
                _id: exposureNode.id,
                export: exportData,
                ...cleanedExposureData,
                name: typeof cleanedExposureData.name === 'string' ? cleanedExposureData.name : '',
                results: typeof cleanedExposureData.results === 'string' ? cleanedExposureData.results : '',
                canvas: Boolean(exposureData.canvas),
                raster: Boolean(exposureData.raster),
                hasListing: true
            };
        });

        const argumentsNode = nodes.find((n) => n.type === WorkflowNodeType.Arguments);
        const args: ArgumentDefinition[] = argumentsNode?.data.arguments?.arguments ?? [];

        const listingEntries = exposures.map((exposure) => ({
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
};
