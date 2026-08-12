import type { PluginExecutionRuntimeInput } from '@shared/contracts/types/plugin-execution';
import type {
    WorkflowEntrypointExecutionOptions,
    WorkflowExecutionContext,
    WorkflowNode
} from '@shared/contracts/types/workflow.types';

export interface WorkflowEntrypointConfig extends PluginExecutionRuntimeInput {
    argumentsTemplate: string;
}

export interface WorkflowEntrypointExecutionRequest {
    context: WorkflowExecutionContext;
    node: WorkflowNode;
    entrypoint: WorkflowEntrypointConfig;
    execution: WorkflowEntrypointExecutionOptions;
}

export const resolveEntrypointConfig = (
    node: WorkflowNode,
    execution: WorkflowEntrypointExecutionOptions
): WorkflowEntrypointConfig => {
    const entrypointData = node.data.entrypoint;
    const defaults = execution.defaults;
    const errorMessage = execution.errorMessage ?? `Entrypoint ${node.id} is missing runtime configuration`;
    const binaryObjectPath = entrypointData?.binaryObjectPath ?? defaults?.binaryObjectPath;
    const argumentsTemplate = entrypointData?.arguments ?? defaults?.argumentsTemplate;

    if (!binaryObjectPath
        || argumentsTemplate === undefined
        || (execution.requireNonEmptyArguments && !argumentsTemplate)) {
        throw new Error(errorMessage);
    }

    const entrypointType = entrypointData?.type ?? defaults?.entrypointType;
    if (execution.requireEntrypointType && !entrypointType) {
        throw new Error(execution.missingTypeMessage ?? errorMessage);
    }

    return {
        binaryObjectPath,
        ownerClusterId: entrypointData?.ownerClusterId ?? defaults?.ownerClusterId,
        argumentsTemplate,
        entrypointType,
        requirementsFile: entrypointData?.requirementsFile ?? defaults?.requirementsFile,
        entrypointScript: entrypointData?.entrypointScript ?? defaults?.entrypointScript
    };
};
