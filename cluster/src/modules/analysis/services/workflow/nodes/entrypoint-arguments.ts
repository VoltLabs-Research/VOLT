import type { WorkflowDefinition } from '@shared/contracts';
import type { WorkflowEntrypointExecutionRequest } from '@modules/analysis/services/workflow/nodes/entrypoint-config';
import { WorkflowValueResolver } from '@modules/analysis/services/workflow/WorkflowValueResolver';
import {
    buildInferFromContextArgs,
    collectInferFromContextArgumentKeys
} from '@modules/analysis/services/pipeline-context';
import { decodeCliArgumentsToken } from '@shared/application/utilities/serialization';

export interface ResolvedWorkflowEntrypointArgs {
    args: string[];
    resolvedArguments: string;
}

const INLINE_ARGUMENT_TOKEN_PATTERN = /"([^"]*)"|'([^']*)'|(\S+)/g;

const inferFromContextKeysCache = new WeakMap<WorkflowDefinition, string[]>();

const getInferFromContextArgumentKeys = (definition: WorkflowDefinition): string[] => {
    let keys = inferFromContextKeysCache.get(definition);
    if (keys === undefined) {
        keys = collectInferFromContextArgumentKeys(definition);
        inferFromContextKeysCache.set(definition, keys);
    }

    return keys;
};

const parseInlineArguments = (value: string): string[] => [...value.matchAll(INLINE_ARGUMENT_TOKEN_PATTERN)]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .flatMap((token) => decodeCliArgumentsToken(token) ?? [token]);

/**
 * Renders the entrypoint's argument template, splits it into an argv and appends the
 * `inferFromContext` arguments contributed by upstream pipeline stages.
 */
export const resolveEntrypointArgs = ({
    context,
    node,
    entrypoint
}: WorkflowEntrypointExecutionRequest): ResolvedWorkflowEntrypointArgs => {
    const resolvedArguments = new WorkflowValueResolver({
        outputs: context.outputs,
        workflow: context.workflow,
        context,
        currentNodeId: node.id
    }).resolveTemplate(entrypoint.argumentsTemplate);
    const parsedArgs = parseInlineArguments(resolvedArguments);
    const inferFromContextArgs = context.pipelineContext
        ? buildInferFromContextArgs(
            context.pipelineContext,
            getInferFromContextArgumentKeys(context.workflow.definition)
        )
        : [];

    return {
        args: [...parsedArgs, ...inferFromContextArgs],
        resolvedArguments
    };
};
