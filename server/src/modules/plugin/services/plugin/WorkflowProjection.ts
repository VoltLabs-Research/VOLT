import {
    ArgumentDefinition,
    ArgumentVisibilityCondition,
    ExportNodeData,
    ExposureProperty,
    ModifierNodeData,
    WorkflowNodeType
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import Workflow from '@modules/plugin/models/plugin/workflow/Workflow';
import crypto from 'node:crypto';

interface ComputedExposure {
    _id: string;
    id?: string;
    name: string;
    results: string;
    icon?: string;
    hasListing: boolean;
    properties: ExposureProperty[];
    export: ExportNodeData | null;
    exportWhen?: ArgumentVisibilityCondition;
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
    producesExposures: string[];
    requiresExposures: string[];
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
                id: exposure?.id,
                export: exportNode?.data.export ?? null,
                name: exposure?.name ?? '',
                icon: exposure?.icon,
                results: exposure?.results ?? '',
                hasListing: exposure?.hasListing !== false,
                properties: exposure?.properties ?? [],
                exportWhen: exposure?.exportWhen
            };
        });

        const argumentsNode = nodes.find((n) => n.type === WorkflowNodeType.Arguments);
        const args: ArgumentDefinition[] = argumentsNode?.data.arguments?.arguments ?? [];

        const producesExposures = exposures
            .map((exposure) => exposure.id)
            .filter((id): id is string => id !== undefined && id.length >= 1);
        const requiresExposures = args
            .filter((argument) => argument.inferFromContext === true)
            .map((argument) => argument.argument);

        const listingEntries = exposures
            .filter((exposure) => exposure.hasListing)
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
            listingExposures,
            producesExposures,
            requiresExposures
        };
    }
}

export const resolvePluginDisplayName = (workflow: Workflow): string => {
    const modifierNode = workflow.props.nodes.find((node) => node.type === WorkflowNodeType.Modifier);

    return modifierNode?.data?.modifier?.name?.trim() ?? '';
};
const stableStringify = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value) ?? 'null';
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
        `${JSON.stringify(key)}:${stableStringify(record[key])}`
    ).join(',')}}`;
};

interface PipelineStageHashInput {
    trajectoryId: string;
    selectedTimesteps?: number[];
    upstreamStageHashes: string[];
    pluginId: string;
    config: Record<string, unknown>;
}

export const computePipelineStageHash = (input: PipelineStageHashInput): string => {
    const normalizedTimesteps = input.selectedTimesteps
        ? [...new Set(input.selectedTimesteps)].sort((left, right) => left - right)
        : null;

    return crypto
        .createHash('sha256')
        .update(stableStringify({
            trajectoryId: input.trajectoryId,
            selectedTimesteps: normalizedTimesteps,
            upstreamStageHashes: input.upstreamStageHashes,
            pluginId: input.pluginId,
            config: input.config
        }))
        .digest('hex')
        .slice(0, 24);
};

export const computeDumpStageHash = (kind: string, config: Record<string, unknown>): string => {
    return crypto
        .createHash('sha256')
        .update(stableStringify({
            kind,
            config
        }))
        .digest('hex')
        .slice(0, 24);
};
