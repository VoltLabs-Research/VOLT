import { ModifierNodeData } from '../entities/workflow/nodes/ModifierNode';
import { ArgumentDefinition } from '../entities/workflow/nodes/ArgumentNode';
import { ExportNodeData } from '../entities/workflow/nodes/ExportNode';
import Workflow from '../entities/workflow/Workflow';
import { WorkflowNodeType } from '../entities/workflow/WorkflowNode';
import { parseSchemaAnnotations, ListingField } from '@modules/plugin/infrastructure/utilities/schema-annotations';

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

export interface UnifiedPerAtomEntry {
    exposureId: string;
    exposureName: string;
    properties: string[];
}

export interface PluginProjection {
    modifier: ModifierNodeData | null;
    exposures: ComputedExposure[];
    arguments: ArgumentDefinition[];
    listingExposures: ListingExposuresData | null;
    unifiedPerAtomProperties: UnifiedPerAtomEntry[];
}

const buildListingFromAnnotations = (
    schemaNodeId: string,
    listingFields: ListingField[]
): Record<string, string> => {
    const listing: Record<string, string> = {};

    for (const field of listingFields) {
        if (field.kind === 'primitive') {
            listing[`{{ ${schemaNodeId}.definition.${field.path} }}`] = field.label;
        }

        if (field.kind === 'array' && field.labels) {
            for (let i = 0; i < field.labels.length; i++) {
                listing[`{{ ${schemaNodeId}.definition.${field.path}.${i} }}`] = `${field.label} ${field.labels[i]}`;
            }
        }

        if (field.kind === 'object') {
            listing[`{{ ${schemaNodeId}.definition.${field.path}.* }}`] = 'auto';
        }
    }

    return listing;
};

export default class WorkflowProjectionService {
    static project(workflow: Workflow, pluginId: string): PluginProjection {
        const nodes = workflow.props.nodes;

        const modifierNode = nodes.find((n) => n.type === WorkflowNodeType.Modifier);
        const modifier = modifierNode?.data?.modifier ?? null;

        const exposureNodes = nodes.filter((n) => n.type === WorkflowNodeType.Exposure);
        const allPerAtomEntries: UnifiedPerAtomEntry[] = [];

        const exposures: ComputedExposure[] = exposureNodes.map((exposureNode) => {
            const visualizersNode = workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Visualizers);
            const schemaNode = workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Schema);
            const exportNode = workflow.findDescendantByType(exposureNode.id, WorkflowNodeType.Export);

            const exposureData = exposureNode.data.exposure || {} as Record<string, unknown>;
            const { _id: _, id: __, ...cleanedExposureData } = exposureData as Record<string, unknown>;

            const visualizersData = visualizersNode?.data.visualizers || {} as Record<string, unknown>;
            const { _id: _v, id: __v, ...cleanedVisualizersData } = visualizersData as Record<string, unknown>;

            const exportData = exportNode?.data.export || {} as Record<string, unknown>;
            const { _id: _e, id: __e, ...cleanedExportData } = exportData as Record<string, unknown>;

            let listing: Record<string, string> | null = null;
            let perAtomProperties: string[] = [];

            if (schemaNode?.data?.schema?.definition) {
                const annotations = parseSchemaAnnotations(
                    schemaNode.data.schema.definition as Record<string, unknown>
                );

                if (annotations.listingFields.length > 0) {
                    listing = buildListingFromAnnotations(schemaNode.id, annotations.listingFields);
                }

                perAtomProperties = annotations.perAtomProperties;
            }

            const exposureName = typeof cleanedExposureData.name === 'string'
                ? cleanedExposureData.name
                : '';

            if (perAtomProperties.length > 0) {
                allPerAtomEntries.push({
                    exposureId: exposureNode.id,
                    exposureName,
                    properties: perAtomProperties
                });
            }

            return {
                _id: exposureNode.id,
                export: Object.keys(cleanedExportData).length > 0 ? cleanedExportData : null,
                ...cleanedExposureData,
                ...cleanedVisualizersData,
                listing,
                perAtomProperties
            } as ComputedExposure;
        });

        const argumentsNode = nodes.find((n) => n.type === WorkflowNodeType.Arguments);
        const args: ArgumentDefinition[] = argumentsNode?.data.arguments?.arguments ?? [];

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

        return {
            modifier,
            exposures,
            arguments: args,
            listingExposures,
            unifiedPerAtomProperties: allPerAtomEntries
        };
    }
}
