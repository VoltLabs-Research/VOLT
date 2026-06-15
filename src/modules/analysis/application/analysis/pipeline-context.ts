import type { WorkflowArgumentDefinition } from '@/modules/analysis/contracts/http-workflow';
import type { WorkflowDefinition } from '@/contracts';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';

// The per-pipeline-run shared context. One instance lives for the whole
// sequential run of a single timestep: every plugin stage registers its
// id-bearing exposures here, and downstream stages with inferFromContext
// arguments read their input file paths back out.
export interface PipelineContext {
    // exposure id -> absolute file path of that exposure's output for this run.
    sharedExposures: Record<string, string>;
    // The run-scoped working directory on the cluster (exposures + working dump).
    pipelineTempPath: string;
}

export const createPipelineContext = (pipelineTempPath: string): PipelineContext => ({
    sharedExposures: {},
    pipelineTempPath
});

// Consumer binary flags and provider exposure ids sometimes disagree on
// hyphen-vs-underscore spelling (e.g. line-reconstruction-dxa's
// `--clusters-table` flag vs PTM's `clusters_table` exposure id). The flag
// spelling is fixed by the binary, so we normalize the LOOKUP key (treating `-`
// and `_` as equivalent) while still injecting the argument's own spelling as
// the flag. Registration also normalizes, so both spellings resolve.
const normalizeContextKey = (key: string): string => key.replace(/-/g, '_');

export const registerSharedExposure = (
    context: PipelineContext,
    exposureId: string,
    filePath: string
): void => {
    if (exposureId.length < 1) {
        return;
    }
    // Overwrite by design: the latest producer of an id wins.
    context.sharedExposures[normalizeContextKey(exposureId)] = filePath;
};

export const resolveSharedExposure = (
    context: PipelineContext,
    argumentKey: string
): string | undefined => {
    return context.sharedExposures[normalizeContextKey(argumentKey)];
};

// The argument keys of a workflow's `arguments` node that are inferFromContext.
export const collectInferFromContextArgumentKeys = (
    workflow: WorkflowDefinition
): string[] => {
    const argumentsNode = workflow.nodes.find((node) => node.type === WorkflowNodeType.Arguments);
    const definitions: WorkflowArgumentDefinition[] = argumentsNode?.data.arguments?.arguments ?? [];
    return definitions
        .filter((definition) => definition.inferFromContext === true && typeof definition.argument === 'string')
        .map((definition) => definition.argument as string);
};

// Build the `--<key> <path>` argv pairs a stage's inferFromContext arguments
// resolve to from the shared context. Throws if a required upstream exposure was
// never produced (the pipeline ordering guarantees it must run first).
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
