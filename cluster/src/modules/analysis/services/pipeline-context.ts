import type { PipelineContext } from '@shared/contracts/types/pipeline-context';
import type { WorkflowArgumentDefinition } from '@shared/contracts/types/http-workflow';
import type { WorkflowDefinition } from '@shared/contracts';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';

export const createPipelineContext = (pipelineTempPath: string): PipelineContext => ({
    sharedExposures: {},
    pipelineTempPath
});

const normalizeContextKey = (key: string): string => key.replace(/-/g, '_');

export const registerSharedExposure = (
    context: PipelineContext,
    exposureId: string,
    filePath: string
): void => {
    if (exposureId.length < 1) {
        return;
    }
    context.sharedExposures[normalizeContextKey(exposureId)] = filePath;
};

export const resolveSharedExposure = (
    context: PipelineContext,
    argumentKey: string
): string | undefined => {
    return context.sharedExposures[normalizeContextKey(argumentKey)];
};

export const collectInferFromContextArgumentKeys = (
    workflow: WorkflowDefinition
): string[] => {
    const argumentsNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Arguments);
    const definitions: WorkflowArgumentDefinition[] = argumentsNode?.data.arguments?.arguments ?? [];
    return definitions.flatMap((definition) => (
        definition.inferFromContext === true && definition.argument !== undefined
            ? [definition.argument]
            : []
    ));
};

export const buildInferFromContextArgs = (
    context: PipelineContext,
    inferKeys: string[]
): string[] => {
    const args: string[] = [];
    for (const key of inferKeys) {
        const path = resolveSharedExposure(context, key);
        if (path === undefined) {
            throw new Error(
                `Pipeline stage requires shared exposure "${key}" but no upstream stage produced it. `
                + `Add a plugin that exports an exposure with id "${key}" before this stage.`
            );
        }
        args.push(`--${key}`, path);
    }
    return args;
};
