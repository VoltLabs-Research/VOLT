import type Workflow from '@modules/plugin/models/plugin/workflow/Workflow';
import crypto from 'node:crypto';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import type {
    IArgumentDefinition,
    IArgumentVisibilityCondition,
    IExportData,
    IModifierData
} from '@volt/contracts/modules/plugin/workflow';
import type { IExposurePanel, IExposureProperty } from '@volt/contracts/modules/plugin/exposure';

interface ComputedExposure {
    _id: string;
    id?: string;
    name: string;
    results: string;
    icon?: string;
    hasListing: boolean;
    properties: IExposureProperty[];
    export: IExportData | null;
    exportWhen?: IArgumentVisibilityCondition;
    panel?: IExposurePanel;
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
    modifier: IModifierData | null;
    exposures: ComputedExposure[];
    arguments: IArgumentDefinition[];
    listingExposures: ListingExposuresData | null;
    producesExposures: string[];
    requiresExposures: string[];
}

export default class WorkflowProjectionService {
    static project(workflow: Workflow, pluginId: string): PluginProjection {
        const nodes = workflow.props.nodes;

        const modifierNode = nodes.find((n) => n.type === NodeType.MODIFIER);
        const modifier = modifierNode?.data?.modifier ?? null;

        const exposureNodes = nodes.filter((n) => n.type === NodeType.EXPOSURE);

        const exposures: ComputedExposure[] = exposureNodes.map((exposureNode) => {
            const exportNode = workflow.findDescendantByType(exposureNode.id, NodeType.EXPORT);
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
                exportWhen: exposure?.exportWhen,
                panel: exposure?.panel
            };
        });

        const argumentsNode = nodes.find((n) => n.type === NodeType.ARGUMENTS);
        const args: IArgumentDefinition[] = argumentsNode?.data.arguments?.arguments ?? [];

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
    const modifierNode = workflow.props.nodes.find((node) => node.type === NodeType.MODIFIER);

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
    pluginBinaryHash?: string;
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
            ...(input.pluginBinaryHash ? { pluginBinaryHash: input.pluginBinaryHash } : {}),
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
