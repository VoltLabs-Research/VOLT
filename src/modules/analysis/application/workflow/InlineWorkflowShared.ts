import type { WorkflowPluginReferenceSelection, WorkflowPluginReferenceValue } from '@/contracts';
import { decodeCliArgumentsToken } from '@/support/serialization/serialization';

export interface InlineExposureArtifact {
    exposureId: string;
    name: string;
    results: string;
    filePath: string;
}

interface WorkflowExecutionResultOutput {
    execution_result?: {
        exposures?: {
            items?: InlineExposureArtifact[];
        };
    };
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

export const readWorkflowPluginReferenceSelections = (
    value: unknown
): WorkflowPluginReferenceSelection[] => {
    return ((value as WorkflowPluginReferenceValue | undefined)?.selections ?? [])
        .filter((selection) => selection.pluginId.trim().length > 0)
        .map((selection) => ({
            pluginId: selection.pluginId.trim(),
            config: selection.config ?? {}
        }));
};

export const readNestedExposureItems = (output: Record<string, unknown>): InlineExposureArtifact[] => {
    return (output as WorkflowExecutionResultOutput).execution_result?.exposures?.items ?? [];
};
