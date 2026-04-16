import { EntrypointType } from '@/shared/contracts';
import { decodeCliArgumentsToken } from '@/shared/utils';
import { isRecord } from '@/shared/utilities/type-guards';

export interface InlineExposureArtifact {
    exposureId: string;
    name: string;
    results: string;
    filePath: string;
}

interface WorkflowExposureData {
    name?: string;
    results?: string;
}

export interface WorkflowPluginNodeData {
    executionMode?: string;
    pluginId?: string;
    argumentReference?: string;
    config?: Record<string, unknown>;
    configByPluginId?: Record<string, Record<string, unknown>>;
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

interface WorkflowPluginReferenceSelection {
    pluginId: string;
    config: Record<string, unknown>;
}

const resolveWorkflowPluginNodeExecutionMode = (value: Record<string, unknown>): string | undefined => {
    if (typeof value.executionMode === 'string') {
        return value.executionMode;
    }

    const pluginId = typeof value.pluginId === 'string'
        ? value.pluginId.trim()
        : '';
    const argumentReference = typeof value.argumentReference === 'string'
        ? value.argumentReference.trim()
        : '';

    if (!pluginId && argumentReference) {
        return 'argumentReference';
    }

    return pluginId ? 'manual' : undefined;
};

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

    const configByPluginId = isRecord(value.configByPluginId)
        ? Object.fromEntries(
            Object.entries(value.configByPluginId).filter((entry): entry is [string, Record<string, unknown>] => {
                return isRecord(entry[1]);
            })
        )
        : undefined;

    return {
        executionMode: resolveWorkflowPluginNodeExecutionMode(value),
        pluginId: typeof value.pluginId === 'string' ? value.pluginId : undefined,
        argumentReference: typeof value.argumentReference === 'string' ? value.argumentReference : undefined,
        config: isRecord(value.config) ? value.config : undefined,
        configByPluginId,
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
        type: value.type === EntrypointType.Executable
            || value.type === EntrypointType.PythonScript
            || value.type === EntrypointType.PackagedExecutable
            ? value.type
            : undefined,
        requirementsFile: typeof value.requirementsFile === 'string' ? value.requirementsFile : undefined,
        entrypointScript: typeof value.entrypointScript === 'string' ? value.entrypointScript : undefined,
        timeout: typeof value.timeout === 'number' && Number.isFinite(value.timeout) ? value.timeout : undefined
    };
};

export const readWorkflowPluginReferenceSelections = (
    value: unknown
): WorkflowPluginReferenceSelection[] => {
    if (isRecord(value) && Array.isArray(value.selections)) {
        return value.selections
            .filter((entry): entry is Record<string, unknown> => isRecord(entry))
            .map((entry) => ({
                pluginId: typeof entry.pluginId === 'string' ? entry.pluginId.trim() : '',
                config: isRecord(entry.config) ? entry.config : {}
            }))
            .filter((entry) => entry.pluginId.length > 0);
    }

    if (Array.isArray(value)) {
        return value
            .filter((entry): entry is Record<string, unknown> => isRecord(entry))
            .map((entry) => ({
                pluginId: typeof entry.pluginId === 'string' ? entry.pluginId.trim() : '',
                config: isRecord(entry.config) ? entry.config : {}
            }))
            .filter((entry) => entry.pluginId.length > 0);
    }

    if (isRecord(value) && typeof value.pluginId === 'string' && value.pluginId.trim().length > 0) {
        return [{
            pluginId: value.pluginId.trim(),
            config: isRecord(value.config) ? value.config : {}
        }];
    }

    return [];
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
