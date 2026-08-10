import { toError } from '@shared/application/utilities/error-message';
import { EntrypointType } from '@shared/contracts/types/http-runtime';
import type {
    PersistentPluginInvocationInput,
    PluginExecutionRuntime
} from '@shared/contracts/types/plugin-execution';
import type { SharedFramePublishInput } from '@shared/contracts/types/shared-frame';
import type { TrajectoryFrameData } from '@shared/contracts/types/trajectory-frame-store';
import type { WorkflowExecutionContext, WorkflowNodeOutput } from '@shared/contracts/types/workflow.types';
import type {
    ResolvedWorkflowEntrypointArgs
} from '@modules/analysis/services/workflow/nodes/entrypoint-arguments';
import type {
    WorkflowEntrypointConfig,
    WorkflowEntrypointExecutionRequest
} from '@modules/analysis/services/workflow/nodes/entrypoint-config';
import {
    buildEntrypointNodeOutput,
    resolveNonZeroExitMessage
} from '@modules/analysis/services/workflow/nodes/entrypoint-process-outcome';
import { isRecord } from '@shared/domain/utilities/is-record';

const PERSISTENT_PLUGIN_DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * The rendered argument template doubles as the plugin config channel, and its
 * content is authored outside the daemon, so the parse result is untrusted here.
 */
const buildPluginConfig = (
    preparedArgs: ResolvedWorkflowEntrypointArgs,
    context: WorkflowExecutionContext
): Record<string, unknown> => {
    const base: Record<string, unknown> = { args: preparedArgs.args };
    if (Object.keys(context.userConfig).length > 0) {
        base.workflowConfig = context.userConfig;
    }

    const trimmed = preparedArgs.resolvedArguments.trim();
    if (!trimmed) {
        return base;
    }

    try {
        const parsed = JSON.parse(trimmed) as unknown;
        return isRecord(parsed)
            ? {
 ...base, ...parsed 
}
            : {
 ...base, config: parsed 
};
    } catch {
        return {
 ...base, raw: trimmed 
};
    }
};

const buildSharedFramePublish = (frame: TrajectoryFrameData): SharedFramePublishInput => {
    const atomCount = frame.atomCount;
    const columns: SharedFramePublishInput['columns'] = [
        {
            name: 'positions',
            dtype: 'float32',
            shape: [atomCount, 3],
            data: frame.positions
        },
        {
            name: 'types',
            dtype: 'uint16',
            shape: [atomCount],
            data: frame.types
        }
    ];

    if (frame.ids) {
        columns.push({
            name: 'ids',
            dtype: 'uint32',
            shape: [atomCount],
            data: frame.ids
        });
    }

    for (const [propertyName, column] of Object.entries(frame.properties)) {
        columns.push({
            name: `properties/${propertyName}`,
            dtype: column.dtype === 'i32' ? 'int32' : 'float32',
            shape: [column.values.length],
            data: column.values
        });
    }

    return { columns };
};

/** Plugin stdout is untrusted, so the result is coerced rather than typed. */
const serializePluginResult = (result: unknown): string => {
    if (result === undefined || result === null) {
        return '';
    }

    if (typeof result === 'string') {
        return result;
    }

    try {
        return JSON.stringify(result);
    } catch {
        return String(result);
    }
};

const coerceJsonCompatible = (value: unknown): object | string | number | boolean | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'object'
        || typeof value === 'string'
        || typeof value === 'number'
        || typeof value === 'boolean') {
        return value;
    }

    return String(value);
};

const resolveEntrypointScript = (
    entrypoint: WorkflowEntrypointConfig,
    executionRuntime: PluginExecutionRuntime
): string => {
    const script = executionRuntime.argsPrefix[0] || entrypoint.entrypointScript;
    if (!script) {
        throw new Error('Persistent plugin invocation requires an entrypointScript');
    }

    return script;
};

/**
 * Runs a python entrypoint through the warm persistent plugin pool, or returns null
 * when this entrypoint cannot use it and has to fall back to a one-shot subprocess.
 */
export const runPersistentEntrypoint = async (
    { context, entrypoint, execution }: WorkflowEntrypointExecutionRequest,
    executionRuntime: PluginExecutionRuntime,
    preparedArgs: ResolvedWorkflowEntrypointArgs
): Promise<WorkflowNodeOutput | null> => {
    const { trajectoryFrameStore, ownerClusterId } = execution;
    const pluginRoot = executionRuntime.projectPath;
    if (entrypoint.entrypointType !== EntrypointType.PythonScript
        || !pluginRoot
        || !trajectoryFrameStore
        || !ownerClusterId) {
        return null;
    }

    const timestep = context.selectedTimestep
        ?? context.selectedTimesteps?.[0]
        ?? context.trajectoryFrames[0]?.timestep;
    if (timestep === undefined) {
        return null;
    }

    const frame = await trajectoryFrameStore.readFrame({
        trajectoryId: context.trajectoryId,
        ownerClusterId,
        timestep
    });

    const invocationInput: PersistentPluginInvocationInput = {
        pluginId: context.pluginId,
        pythonCommandPath: executionRuntime.commandPath,
        pluginRoot,
        entrypointScript: resolveEntrypointScript(entrypoint, executionRuntime),
        env: executionRuntime.env,
        logSink: execution.logSink,
        frame: {
            timestep: frame.timestep,
            natoms: frame.atomCount,
            simulationCell: frame.frameBbox.join(',')
        },
        shmFramePublish: buildSharedFramePublish(frame),
        config: buildPluginConfig(preparedArgs, context),
        mode: 'single',
        timeoutMs: PERSISTENT_PLUGIN_DEFAULT_TIMEOUT_MS
    };

    try {
        const { response } = await execution.binaryExecutorService.invokePersistentPlugin(invocationInput);

        if (!response.ok) {
            const errorMessage = response.error?.message ?? 'Persistent plugin returned error';
            if (execution.nonZeroExitMessage) {
                throw new Error(resolveNonZeroExitMessage(execution.nonZeroExitMessage, {
                    code: 1,
                    stdout: '',
                    stderr: [errorMessage, response.error?.traceback ?? ''].filter(Boolean).join('\n')
                }));
            }

            throw new Error(errorMessage);
        }

        return buildEntrypointNodeOutput({
            entrypoint,
            executionRuntime,
            execution,
            args: preparedArgs.args,
            resolvedArguments: preparedArgs.resolvedArguments,
            result: {
                code: 0,
                stdout: serializePluginResult(response.result),
                stderr: ''
            },
            extraOutput: { pluginResult: coerceJsonCompatible(response.result) }
        });
    } catch (error: unknown) {
        const cause = toError(error);
        throw new Error(
            `Persistent plugin invocation failed for ${context.pluginId} (trajectory ${context.trajectoryId}, timestep ${timestep}): ${cause.message}`,
            { cause }
        );
    }
};
