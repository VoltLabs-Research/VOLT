import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { ObjectBucketName, VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@/contracts';
import { createZstdDecompressionStream, stripZstdExtension } from '@/support/serialization/storage-codec';
import type { BinaryExecutorService, ProcessExecutionLogSink } from '@/core/runtime/infrastructure/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/plugin/application/binaries/PluginBinaryCacheService';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import type { WorkflowExecutionContext, WorkflowNode } from '@/modules/analysis/contracts/workflow.types';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import { executeWorkflowEntrypoint } from '@/modules/analysis/application/workflow/WorkflowEntrypointExecution';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

interface DebugDumpDescriptor {
    timestep: number;
    natoms: number;
    simulationCell: string;
    path: string;
    originalPath?: string;
};

interface DebugEntrypointExecutionResult {
    output: Record<string, unknown>;
    dumpPath: string;
    outputDir: string;
}

interface SelectedDebugDump {
    dump: DebugDumpDescriptor;
    index: number;
}

export interface PreparedDebugExecutionEnvironment {
    selectedDump: DebugDumpDescriptor;
    selectedDumpIndex: number;
    dumpPath: string;
    outputDir: string;
    outputSnapshot: DebugExecutionOutputSnapshot;
}

interface DebugExecutionOutputSnapshot {
    contextNodeId?: string;
    contextOutput?: Record<string, unknown>;
    forEachNodeId?: string;
    forEachOutput?: Record<string, unknown>;
}

const snapshotDebugExecutionOutputs = (
    context: WorkflowExecutionContext
): DebugExecutionOutputSnapshot => {
    const contextNode = context.workflow.nodes.find((entry) => entry.type === WorkflowNodeType.Context);
    const forEachNode = context.workflow.nodes.find((entry) => entry.type === WorkflowNodeType.ForEach);

    return {
        contextNodeId: contextNode?.id,
        contextOutput: contextNode ? context.outputs.get(contextNode.id) : undefined,
        forEachNodeId: forEachNode?.id,
        forEachOutput: forEachNode ? context.outputs.get(forEachNode.id) : undefined
    };
};

const restoreDebugExecutionOutputs = (
    context: WorkflowExecutionContext,
    snapshot: DebugExecutionOutputSnapshot
): void => {
    if (snapshot.contextNodeId) {
        if (snapshot.contextOutput) {
            context.outputs.set(snapshot.contextNodeId, snapshot.contextOutput);
        } else {
            context.outputs.delete(snapshot.contextNodeId);
        }
    }

    if (snapshot.forEachNodeId) {
        if (snapshot.forEachOutput) {
            context.outputs.set(snapshot.forEachNodeId, snapshot.forEachOutput);
        } else {
            context.outputs.delete(snapshot.forEachNodeId);
        }
    }
};

const normalizeObjectKey = (value: string): string => {
    return value.startsWith('/')
        ? value.slice(1)
        : value;
};

const resolveSelectedDumpDescriptor = (
    context: WorkflowExecutionContext
): SelectedDebugDump | null => {
    const selectedTimestep = typeof context.selectedTimestep === 'number'
        ? context.selectedTimestep
        : undefined;
    const forEachNode = context.workflow.nodes.find((node) => node.type === WorkflowNodeType.ForEach);

    if (forEachNode) {
        const forEachOutput = context.outputs.get(forEachNode.id);
        const items = (forEachOutput?.items as DebugDumpDescriptor[] | undefined) ?? [];

        if (selectedTimestep !== undefined) {
            const selectedIndex = items.findIndex((item) => item.timestep === selectedTimestep);
            if (selectedIndex !== -1) {
                return {
                    dump: items[selectedIndex],
                    index: selectedIndex
                };
            }

            throw new Error(`Selected timestep ${selectedTimestep} is not available for debug execution`);
        }

        if (items.length > 0) {
            return {
                dump: items[0],
                index: 0
            };
        }
    }

    const contextNode = context.workflow.nodes.find((node) => node.type === WorkflowNodeType.Context);
    if (!contextNode) {
        return null;
    }

    const contextOutput = context.outputs.get(contextNode.id);
    const dumps = (contextOutput?.trajectory_dumps as DebugDumpDescriptor[] | undefined) ?? [];

    if (selectedTimestep !== undefined) {
        const selectedIndex = dumps.findIndex((dump) => dump.timestep === selectedTimestep);
        if (selectedIndex !== -1) {
            return {
                dump: dumps[selectedIndex],
                index: selectedIndex
            };
        }

        throw new Error(`Selected timestep ${selectedTimestep} is not available for debug execution`);
    }

    return dumps[0]
        ? {
            dump: dumps[0],
            index: 0
        }
        : null;
};

const updateContextOutputsForDebugExecution = (
    context: WorkflowExecutionContext,
    selectedDump: DebugDumpDescriptor,
    selectedDumpIndex: number,
    dumpPath: string,
    outputDir: string
): void => {
    const localDumpDescriptor: DebugDumpDescriptor = {
        ...selectedDump,
        path: dumpPath,
        originalPath: selectedDump.originalPath ?? selectedDump.path
    };

    const contextNode = context.workflow.nodes.find((node) => node.type === WorkflowNodeType.Context);
    if (contextNode) {
        const currentContextOutput = context.outputs.get(contextNode.id) ?? {};
        const trajectory = {
            ...(currentContextOutput.trajectory as Record<string, unknown> | undefined)
        };

        trajectory.frames = [localDumpDescriptor];

        context.outputs.set(contextNode.id, {
            ...currentContextOutput,
            trajectory_dumps: [localDumpDescriptor],
            count: 1,
            trajectory,
            allDumpLocalPaths: JSON.stringify([dumpPath]),
            outputPath: outputDir
        });
    }

    const forEachNode = context.workflow.nodes.find((node) => node.type === WorkflowNodeType.ForEach);
    if (!forEachNode) {
        return;
    }

    const currentForEachOutput = context.outputs.get(forEachNode.id) ?? {};
    context.outputs.set(forEachNode.id, {
        ...currentForEachOutput,
        currentValue: localDumpDescriptor,
        currentIndex: selectedDumpIndex,
        outputPath: outputDir
    });
};

const downloadDumpForDebugExecution = async (
    objectStore: ClusterObjectStore,
    objectKey: string,
    ownerClusterId: string
): Promise<string> => {
    const normalizedObjectKey = normalizeObjectKey(objectKey);
    if (!normalizedObjectKey.endsWith('.dump.zst')) {
        throw new Error(`Invalid dump object key received: ${objectKey}`);
    }

    const fileName = path.basename(normalizedObjectKey);
    const localFileName = path.basename(stripZstdExtension(fileName));
    const localPath = path.join(DAEMON_PATHS.analysisDumps, `${localFileName}-${Date.now()}`);

    await fs.mkdir(path.dirname(localPath), { recursive: true });

    const response = await objectStore.getStream(
        ownerClusterId,
        ObjectBucketName.Dumps,
        normalizedObjectKey,
        {
            skipMetadata: true
        }
    );
    const decompressed = createZstdDecompressionStream(response.stream);
    await pipeline(decompressed.stream, createWriteStream(localPath));
    await decompressed.completion;

    logger.info(
        {
            objectKey: normalizedObjectKey,
            localPath
        },
        '@debug-entrypoint-executor: dump downloaded for debug session'
    );

    return localPath;
};

export class DebugEntrypointExecutor {
    constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly pluginBinaryCacheService: PluginBinaryCacheService,
        private readonly binaryExecutorService: BinaryExecutorService
    ) {}

    async execute(
        sessionId: string,
        node: WorkflowNode,
        context: WorkflowExecutionContext,
        storageClusterId?: string
    ): Promise<DebugEntrypointExecutionResult> {
        const preparedEnvironment = await this.prepareExecutionEnvironment(
            sessionId,
            context,
            storageClusterId
        );

        try {
            return await this.executePrepared(node, context, preparedEnvironment);
        } catch (error) {
            const cleanupTasks: Array<Promise<unknown>> = [
                fs.rm(preparedEnvironment.dumpPath, { force: true }).catch(() => {}),
                fs.rm(preparedEnvironment.outputDir, { recursive: true, force: true }).catch(() => {})
            ];
            await Promise.all(cleanupTasks);
            restoreDebugExecutionOutputs(context, preparedEnvironment.outputSnapshot);
            throw error;
        }
    }

    async prepareExecutionEnvironment(
        sessionId: string,
        context: WorkflowExecutionContext,
        storageClusterId?: string
    ): Promise<PreparedDebugExecutionEnvironment> {
        const resolvedStorageClusterId = storageClusterId || VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID;
        if (!storageClusterId) {
            logger.warn(
                {
                    sessionId,
                    fallbackOwnerClusterId: resolvedStorageClusterId
                },
                '@debug-entrypoint-executor: missing trajectory storage cluster id, falling back to Volt server owner'
            );
        }

        const selectedDump = resolveSelectedDumpDescriptor(context);
        if (!selectedDump) {
            throw new Error('No selected trajectory dump is available for debug execution');
        }

        const dumpPath = await downloadDumpForDebugExecution(
            this.objectStore,
            selectedDump.dump.path,
            resolvedStorageClusterId
        );
        const outputDir = path.join(DAEMON_PATHS.analysisOutput, `debug-${sessionId}-${Date.now()}`);
        await fs.mkdir(outputDir, { recursive: true });

        const outputSnapshot = snapshotDebugExecutionOutputs(context);
        updateContextOutputsForDebugExecution(context, selectedDump.dump, selectedDump.index, dumpPath, outputDir);

        return {
            selectedDump: selectedDump.dump,
            selectedDumpIndex: selectedDump.index,
            dumpPath,
            outputDir,
            outputSnapshot
        };
    }

    async executePrepared(
        node: WorkflowNode,
        context: WorkflowExecutionContext,
        preparedEnvironment: PreparedDebugExecutionEnvironment,
        logSink?: ProcessExecutionLogSink
    ): Promise<DebugEntrypointExecutionResult> {
        const entrypointData = node.data.entrypoint;
        const binaryObjectPath = entrypointData?.binaryObjectPath?.trim() ?? '';
        const argumentsTemplate = entrypointData?.arguments ?? '';

        if (!binaryObjectPath || !argumentsTemplate) {
            throw new Error(`Entrypoint ${node.id} is missing runtime configuration`);
        }

        logger.info(
            {
                nodeId: node.id,
                binaryObjectPath,
                outputDir: preparedEnvironment.outputDir
            },
            '@debug-entrypoint-executor: executing plugin entrypoint'
        );

        return {
            dumpPath: preparedEnvironment.dumpPath,
            outputDir: preparedEnvironment.outputDir,
            output: await executeWorkflowEntrypoint({
                outputs: context.outputs,
                workflow: context.workflow,
                nodeId: node.id,
                entrypoint: {
                    binaryObjectPath,
                    argumentsTemplate,
                    entrypointType: entrypointData?.type,
                    requirementsFile: entrypointData?.requirementsFile,
                    entrypointScript: entrypointData?.entrypointScript,
                    timeoutMs: entrypointData?.timeout
                },
                jobId: `debug:${node.id}:${Date.now()}`,
                outputDir: preparedEnvironment.outputDir,
                pluginBinaryCacheService: this.pluginBinaryCacheService,
                binaryExecutorService: this.binaryExecutorService,
                logSink,
                restoreOutputOnError: true,
                includeOutputFiles: true,
                nonZeroExitMessage: (result) => `Entrypoint exited with code ${result.code}: ${result.stderr || result.stdout || 'Unknown error'}`,
                extraOutput: {
                    dumpPath: preparedEnvironment.dumpPath
                }
            })
        };
    }
}
