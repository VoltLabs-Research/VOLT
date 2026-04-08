import { EntrypointType, type PluginReferenceExecutionRequest, type WorkflowDefinition } from '@/shared/contracts';
import { decodeCliArgumentsToken, isRecord } from '@/shared/utils';
import { WorkflowNodeType } from '../contracts';
import fs from 'node:fs/promises';

export interface InlineExposureArtifact {
    exposureId: string;
    name: string;
    results: string;
    filePath: string;
}

export interface WorkflowExposureData {
    name?: string;
    results?: string;
}

export interface WorkflowPluginNodeData {
    pluginId?: string;
    config?: Record<string, unknown>;
    selectedTimesteps?: number[];
}

export interface WorkflowEntrypointData {
    arguments?: string;
    binaryObjectPath?: string;
    entrypointScript?: string;
    requirementsFile?: string;
    timeout?: number;
    type?: EntrypointType;
}

export interface InlineWorkflowDumpTarget {
    localPath: string;
    originalPath?: string;
    timestep: number;
    natoms: number;
    simulationCell: string;
}

export const parseInlineWorkflowArguments = (value: string): string[] => {
    if (!value) {
        return [];
    }

    const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
    const tokens = [...value.matchAll(regex)].map((match) => match[1] ?? match[2] ?? match[3]);

    return tokens.flatMap((token) => {
        const encodedArguments = decodeCliArgumentsToken(token);
        return encodedArguments ?? [token];
    });
};

export const createNestedExecutionResult = (items: InlineExposureArtifact[]): Record<string, unknown> => ({
    execution_result: {
        exposures: {
            items,
            str_json: JSON.stringify(items)
        }
    }
});

export const isInlinePluginReferenceExecutionRequest = (value: unknown): value is PluginReferenceExecutionRequest => {
    return isRecord(value)
        && typeof value.referencePath === 'string'
        && typeof value.pluginId === 'string'
        && isRecord(value.config);
};

export const createInlinePluginReferenceDedupeKey = (
    request: Pick<PluginReferenceExecutionRequest, 'pluginId' | 'config'>
): string => {
    return JSON.stringify({
        pluginId: request.pluginId,
        config: request.config
    });
};

export const readWorkflowExposureData = (value: unknown): WorkflowExposureData | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }

    return {
        name: typeof value.name === 'string' ? value.name : undefined,
        results: typeof value.results === 'string' ? value.results : undefined
    };
};

export const readWorkflowPluginNodeData = (value: unknown): WorkflowPluginNodeData | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }

    return {
        pluginId: typeof value.pluginId === 'string' ? value.pluginId : undefined,
        config: isRecord(value.config) ? value.config : undefined,
        selectedTimesteps: Array.isArray(value.selectedTimesteps)
            ? value.selectedTimesteps.filter((entry): entry is number => typeof entry === 'number')
            : undefined
    };
};

export const readWorkflowEntrypointData = (value: unknown): WorkflowEntrypointData | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }

    return {
        binaryObjectPath: typeof value.binaryObjectPath === 'string' ? value.binaryObjectPath : undefined,
        arguments: typeof value.arguments === 'string' ? value.arguments : undefined,
        type: value.type === EntrypointType.Executable || value.type === EntrypointType.PythonScript
            ? value.type
            : undefined,
        requirementsFile: typeof value.requirementsFile === 'string' ? value.requirementsFile : undefined,
        entrypointScript: typeof value.entrypointScript === 'string' ? value.entrypointScript : undefined,
        timeout: typeof value.timeout === 'number' && Number.isFinite(value.timeout) ? value.timeout : undefined
    };
};

export const setNestedValueAtPath = (target: Record<string, unknown>, pathExpression: string, value: unknown): void => {
    const segments = pathExpression
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .filter(Boolean);

    if (!segments.length) {
        return;
    }

    let cursor: unknown = target;
    for (let index = 0; index < segments.length - 1; index += 1) {
        const segment = segments[index];
        const nextSegment = segments[index + 1];
        const nextIsIndex = /^\d+$/.test(nextSegment);

        if (Array.isArray(cursor)) {
            const arrayIndex = Number(segment);
            if (!Number.isInteger(arrayIndex)) {
                return;
            }

            const currentValue = cursor[arrayIndex];
            if (!Array.isArray(currentValue) && !isRecord(currentValue)) {
                const nextContainer = nextIsIndex ? [] : {};
                cursor[arrayIndex] = nextContainer;
                cursor = nextContainer;
                continue;
            }

            cursor = currentValue;
            continue;
        }

        if (!isRecord(cursor)) {
            return;
        }

        const currentValue = cursor[segment];
        if (!Array.isArray(currentValue) && !isRecord(currentValue)) {
            const nextContainer = nextIsIndex ? [] : {};
            cursor[segment] = nextContainer;
            cursor = nextContainer;
            continue;
        }

        cursor = currentValue;
    }

    const finalSegment = segments[segments.length - 1];
    if (Array.isArray(cursor)) {
        const arrayIndex = Number(finalSegment);
        if (Number.isInteger(arrayIndex)) {
            cursor[arrayIndex] = value;
        }
        return;
    }

    if (!isRecord(cursor)) {
        return;
    }

    cursor[finalSegment] = value;
};

export const readNestedExposureItems = (output: Record<string, unknown>): InlineExposureArtifact[] => {
    const executionResult = isRecord(output.execution_result) ? output.execution_result : undefined;
    const exposures = executionResult && isRecord(executionResult.exposures)
        ? executionResult.exposures
        : undefined;
    const items = exposures?.items;

    return Array.isArray(items)
        ? items.filter((item): item is InlineExposureArtifact => isRecord(item)
            && typeof item.exposureId === 'string'
            && typeof item.name === 'string'
            && typeof item.results === 'string'
            && typeof item.filePath === 'string')
        : [];
};

const getSingleAdjacentNodeId = (
    adjacencyMap: Map<string, string[]>,
    nodeId: string,
    errorMessage: string
): string | undefined => {
    const adjacentNodeIds = adjacencyMap.get(nodeId) ?? [];
    if (adjacentNodeIds.length > 1) {
        throw new Error(errorMessage);
    }

    return adjacentNodeIds[0];
};

export const resolveInlinePluginExecutionOrder = (
    workflow: WorkflowDefinition
): WorkflowDefinition['nodes'] => {
    const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]));
    const totalPluginNodes = workflow.nodes.filter((node) => node.type === WorkflowNodeType.Plugin).length;
    const parentMap = new Map<string, string[]>();
    const childMap = new Map<string, string[]>();

    for (const edge of workflow.edges) {
        const parents = parentMap.get(edge.target) ?? [];
        parents.push(edge.source);
        parentMap.set(edge.target, parents);

        const children = childMap.get(edge.source) ?? [];
        children.push(edge.target);
        childMap.set(edge.source, children);
    }

    const entrypointNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);
    if (!entrypointNode) {
        throw new Error('Workflow entrypoint is missing');
    }

    let currentNodeId = getSingleAdjacentNodeId(
        parentMap,
        entrypointNode.id,
        `Top-level entrypoint ${entrypointNode.id} must have a single upstream chain`
    );
    const pluginNodes: WorkflowDefinition['nodes'] = [];

    while (currentNodeId) {
        const currentNode = nodeMap.get(currentNodeId);
        if (!currentNode) {
            throw new Error(`Workflow node ${currentNodeId} is missing from the inline plugin chain`);
        }

        if (currentNode.type === WorkflowNodeType.ForEach || currentNode.type === WorkflowNodeType.Context) {
            if (pluginNodes.length !== totalPluginNodes) {
                throw new Error('Unsupported inline plugin topology outside the entrypoint chain');
            }

            return pluginNodes.reverse();
        }

        if (currentNode.type !== WorkflowNodeType.Plugin) {
            throw new Error(`Unsupported inline plugin topology at node ${currentNode.id}`);
        }

        const pluginNodeData = readWorkflowPluginNodeData(currentNode.data.pluginNode);
        const pluginId = typeof pluginNodeData?.pluginId === 'string'
            ? pluginNodeData.pluginId.trim()
            : '';
        if (!pluginId) {
            throw new Error(`Plugin node ${currentNode.id} is missing pluginId`);
        }

        getSingleAdjacentNodeId(
            childMap,
            currentNode.id,
            `Plugin node ${currentNode.id} must have a single downstream chain`
        );
        pluginNodes.push(currentNode);
        currentNodeId = getSingleAdjacentNodeId(
            parentMap,
            currentNode.id,
            `Plugin node ${currentNode.id} must have a single upstream chain`
        );
    }

    if (pluginNodes.length !== totalPluginNodes) {
        throw new Error('Unsupported inline plugin topology outside the entrypoint chain');
    }

    throw new Error('Inline plugin chain must originate from the top-level forEach or context node');
};

export const collectInlineExposureArtifacts = async (
    workflow: WorkflowDefinition,
    outputDir: string
): Promise<InlineExposureArtifact[]> => {
    const artifacts: InlineExposureArtifact[] = [];

    for (const node of workflow.nodes) {
        if (node.type !== WorkflowNodeType.Exposure) {
            continue;
        }

        const exposureData = readWorkflowExposureData(node.data.exposure);
        const results = exposureData?.results || '';
        if (!results) {
            continue;
        }

        const filePath = `${outputDir}_${results}`;
        try {
            await fs.access(filePath);
            artifacts.push({
                exposureId: node.id,
                name: exposureData?.name || node.id,
                results,
                filePath
            });
        } catch {
        }
    }

    return artifacts;
};
