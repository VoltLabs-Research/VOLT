import type { WorkflowPluginReferenceSelection, WorkflowPluginReferenceValue } from '@/contracts';
import type { WorkflowNodeOutput } from '@/modules/analysis/contracts/workflow.types';
import { decodeCliArgumentsToken } from '@/support/serialization/serialization';

export interface InlineExposureArtifact {
    exposureId: string;
    name: string;
    results: string;
    filePath: string;
}

interface WorkflowExecutionResultExposures {
    items: InlineExposureArtifact[];
    str_json: string;
}

interface WorkflowExecutionResultData {
    exposures: WorkflowExecutionResultExposures;
}

export interface WorkflowExecutionResultOutput extends WorkflowNodeOutput {
    execution_result: WorkflowExecutionResultData;
}

export interface InlineWorkflowDumpTarget {
    localPath: string;
    originalPath?: string;
    timestep: number;
    natoms: number;
    simulationCell: string;
}

export interface WorkflowPluginReferenceSelectionWithConfig extends WorkflowPluginReferenceSelection {
    config: WorkflowNodeOutput;
}

export interface WorkflowPluginReferenceValueWithSelections extends WorkflowPluginReferenceValue {
    selections: WorkflowPluginReferenceSelectionWithConfig[];
}

export const parseInlineWorkflowArguments = (value: string): string[] => {
    if (!value) {
        return [];
    }

    const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
    const tokens = [...value.matchAll(regex)].map((match) => match[1] ?? match[2] ?? match[3]);

    return tokens.flatMap((token) => {
        const encodedArguments = decodeCliArgumentsToken(token);
        if (encodedArguments !== null) {
            return encodedArguments;
        }

        return [token];
    });
};

export const createNestedExecutionResult = (items: InlineExposureArtifact[]): WorkflowExecutionResultOutput => ({
    execution_result: {
        exposures: {
            items,
            str_json: JSON.stringify(items)
        }
    }
});
