import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import { executeDebugExportNode } from '@modules/analysis/services/workflow/debug/debug-export-node';
import type { DebugEnvironment, DebugEnvironmentState } from '@modules/analysis/services/workflow/debug/DebugEnvironment';
import type { DebugSession, NodeExecutionOutcome } from '@modules/analysis/services/workflow/debug/debug-session';
import type { WorkflowNodeExecutor } from '@modules/analysis/services/workflow/WorkflowNodeExecutor';
import type { WorkflowRuntime } from '@modules/analysis/services/workflow/WorkflowRuntime';
import type { BinaryExecutorService } from '@modules/plugin/services/runtime/BinaryExecutorService';
import type { PluginBinaryCache } from '@modules/plugin/services/binaries/PluginBinaryCache';
import type { WorkflowExecutionContext, WorkflowNode } from '@shared/contracts/types/workflow.types';

export interface DebugNodeExecutionDependencies {
    nodeExecutor: WorkflowNodeExecutor;
    debugEnvironment: DebugEnvironment;
    workflowRuntime: WorkflowRuntime;
    pluginBinaryCache: PluginBinaryCache;
    binaryExecutorService: BinaryExecutorService;
}

export type DebugNodeRunner = (session: DebugSession, node: WorkflowNode) => Promise<NodeExecutionOutcome>;

/**
 * Builds the "run one node of a paused workflow" step. Entrypoint, exposure, export and
 * plugin nodes all need the session's dump and output directory on disk, so the first of
 * them to run materialises it and the rest of the session reuses it.
 */
export const createDebugNodeRunner = (deps: DebugNodeExecutionDependencies): DebugNodeRunner => {
    const ensureEnvironment = async (session: DebugSession): Promise<DebugEnvironmentState> => {
        if (session.preparedExecution) {
            return session.preparedExecution;
        }

        const preparedExecution = await deps.debugEnvironment.prepare(
            session.sessionId,
            session.context,
            session.storageClusterId
        );
        session.preparedExecution = preparedExecution;
        session.cleanupPaths.push(preparedExecution.dumpPath);
        session.cleanupDirectories.push(preparedExecution.outputDir);

        return preparedExecution;
    };

    const buildContext = async (session: DebugSession, node: WorkflowNode): Promise<WorkflowExecutionContext> => {
        const isEntrypoint = node.type === WorkflowNodeType.Entrypoint;
        if (!isEntrypoint && node.type !== WorkflowNodeType.Exposure) {
            return session.context;
        }

        const preparedExecution = await ensureEnvironment(session);
        const execution = session.context.execution;

        return {
            ...session.context,
            execution: isEntrypoint
                ? {
                    ...execution,
                    entrypoint: {
                        ...execution?.entrypoint,
                        jobId: `debug:${node.id}:${Date.now()}`,
                        outputDir: preparedExecution.outputDir,
                        pluginBinaryCache: deps.pluginBinaryCache,
                        binaryExecutorService: deps.binaryExecutorService,
                        restoreOutputOnError: true,
                        includeOutputFiles: true,
                        nonZeroExitMessage: (result) => `Entrypoint exited with code ${result.code}: ${result.stderr || result.stdout}`,
                        extraOutput: {
                            dumpPath: preparedExecution.dumpPath
                        },
                        errorMessage: `Entrypoint ${node.id} is missing runtime configuration`
                    }
                }
                : {
                    ...execution,
                    exposure: {
                        ...execution?.exposure,
                        mode: 'debug',
                        outputDir: preparedExecution.outputDir,
                        onInspection: (nodeId, inspection) => {
                            session.exposureCache.set(nodeId, inspection);
                        }
                    }
                }
        };
    };

    /** Expands a plugin node into nested workflow runs, pinned to the session's single dump. */
    const runPluginNode = async (session: DebugSession, node: WorkflowNode): Promise<NodeExecutionOutcome> => {
        const { dumpPath, outputDir, selectedDump } = await ensureEnvironment(session);
        const { context } = session;
        const execution = await deps.workflowRuntime.executePluginNode({
            node,
            workflow: context.workflow.definition,
            nestedPlugins: session.nestedPlugins,
            outputs: context.outputs,
            dumpTarget: {
                localPath: dumpPath,
                originalPath: selectedDump.originalPath ?? selectedDump.path,
                timestep: selectedDump.timestep,
                natoms: selectedDump.natoms,
                simulationCell: selectedDump.simulationCell
            },
            outputDir,
            trajectoryId: context.trajectoryId,
            trajectoryFrames: context.trajectoryFrames,
            analysisId: context.analysisId,
            analysis: context.analysis,
            teamId: context.teamId,
            rootNodeId: node.id,
            executionPath: [node.id],
            captureTrace: true
        });

        context.outputs.set(node.id, execution.output);
        return {
            status: 'executed',
            output: execution.output,
            nestedTrace: execution.trace
        };
    };

    return async (session, node) => {
        if (node.type === WorkflowNodeType.Plugin) {
            return runPluginNode(session, node);
        }

        if (node.type === WorkflowNodeType.Export) {
            return executeDebugExportNode(session, node, await ensureEnvironment(session));
        }

        const result = await deps.nodeExecutor.executeNode(node, await buildContext(session, node));
        if (result.status === 'skipped') {
            return {
                status: 'skipped',
                reason: result.reason!
            };
        }

        const output = result.output!;
        if (output.skipped === true && typeof output.reason === 'string') {
            return {
                status: 'skipped',
                reason: output.reason
            };
        }

        return {
            status: 'executed',
            output
        };
    };
};
