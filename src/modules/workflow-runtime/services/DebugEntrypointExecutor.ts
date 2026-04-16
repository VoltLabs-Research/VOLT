import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { EntrypointType, ObjectBucketName, VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@/shared/contracts';
import { createZstdDecompressionStream, stripZstdExtension } from '@/shared/utilities/storage-codec';
import { isRecord } from '@/shared/utilities/type-guards';
import type {
    BinaryExecutorService,
    ProcessExecutionLogSink
} from '@/modules/job-runtime/services/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/job-runtime/services/PluginBinaryCacheService';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import type { WorkflowExecutionContext, WorkflowNode } from '../contracts';
import { WorkflowNodeType } from '../contracts';
import { parseInlineWorkflowArguments, readWorkflowEntrypointData } from './InlineWorkflowShared';
import { resolveWorkflowTemplate } from './WorkflowOutputResolution';
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

export interface PreparedDebugExecutionEnvironment {
    selectedDump: DebugDumpDescriptor;
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

const isDebugDumpDescriptor = (value: unknown): value is DebugDumpDescriptor => {
    return isRecord(value)
        && typeof value.timestep === 'number'
        && Number.isFinite(value.timestep)
        && typeof value.natoms === 'number'
        && Number.isFinite(value.natoms)
        && typeof value.simulationCell === 'string'
        && typeof value.path === 'string'
        && (typeof value.originalPath === 'undefined' || typeof value.originalPath === 'string');
};

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
): DebugDumpDescriptor | null => {
    const selectedTimestep = typeof context.selectedTimestep === 'number'
        ? context.selectedTimestep
        : undefined;
    const forEachNode = context.workflow.nodes.find((node) => node.type === WorkflowNodeType.ForEach);

    if (forEachNode) {
        const forEachOutput = context.outputs.get(forEachNode.id);
        const items = Array.isArray(forEachOutput?.items)
            ? forEachOutput.items.filter(isDebugDumpDescriptor)
            : [];

        if (selectedTimestep !== undefined) {
            const selectedItem = items.find((item) => item.timestep === selectedTimestep);
            if (selectedItem) {
                return selectedItem;
            }
        }

        if (items.length > 0) {
            return items[0];
        }
    }

    const contextNode = context.workflow.nodes.find((node) => node.type === WorkflowNodeType.Context);
    if (!contextNode) {
        return null;
    }

    const contextOutput = context.outputs.get(contextNode.id);
    const dumps = Array.isArray(contextOutput?.trajectory_dumps)
        ? contextOutput.trajectory_dumps.filter(isDebugDumpDescriptor)
        : [];

    if (selectedTimestep !== undefined) {
        const selectedDump = dumps.find((dump) => dump.timestep === selectedTimestep);
        if (selectedDump) {
            return selectedDump;
        }
    }

    return dumps[0] ?? null;
};

const updateContextOutputsForDebugExecution = (
    context: WorkflowExecutionContext,
    selectedDump: DebugDumpDescriptor,
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
        const trajectory = isRecord(currentContextOutput.trajectory)
            ? { ...currentContextOutput.trajectory }
            : {};

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
        currentIndex: 0,
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
            selectedDump.path,
            resolvedStorageClusterId
        );
        const outputDir = path.join(DAEMON_PATHS.analysisOutput, `debug-${sessionId}-${Date.now()}`);
        await fs.mkdir(outputDir, { recursive: true });

        const outputSnapshot = snapshotDebugExecutionOutputs(context);
        updateContextOutputsForDebugExecution(context, selectedDump, dumpPath, outputDir);

        return {
            selectedDump,
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
        const entrypointData = readWorkflowEntrypointData(node.data.entrypoint);
        const binaryObjectPath = typeof entrypointData?.binaryObjectPath === 'string'
            ? entrypointData.binaryObjectPath.trim()
            : '';
        const argumentsTemplate = typeof entrypointData?.arguments === 'string'
            ? entrypointData.arguments
            : '';

        if (!binaryObjectPath || !argumentsTemplate) {
            throw new Error(`Entrypoint ${node.id} is missing runtime configuration`);
        }

        const normalizedEntrypointData = entrypointData ?? {};
        const executionRuntime = await this.pluginBinaryCacheService.getExecutionRuntime({
            binaryObjectPath,
            entrypointType: normalizedEntrypointData.type === EntrypointType.PythonScript
                ? EntrypointType.PythonScript
                : normalizedEntrypointData.type === EntrypointType.PackagedExecutable
                    ? EntrypointType.PackagedExecutable
                : normalizedEntrypointData.type === EntrypointType.Executable
                    ? EntrypointType.Executable
                    : undefined,
            requirementsFile: typeof normalizedEntrypointData.requirementsFile === 'string'
                ? normalizedEntrypointData.requirementsFile
                : undefined,
            entrypointScript: typeof normalizedEntrypointData.entrypointScript === 'string'
                ? normalizedEntrypointData.entrypointScript
                : undefined
        });
        const previousNodeOutput = context.outputs.get(node.id);
        context.outputs.set(node.id, {
            ...(context.outputs.get(node.id) ?? {}),
            projectPath: executionRuntime.projectPath ?? ''
        });
        try {
            const resolvedArguments = resolveWorkflowTemplate(argumentsTemplate, context.outputs, {
                workflow: context.workflow,
                currentNodeId: node.id
            });
            const args = parseInlineWorkflowArguments(resolvedArguments);
            const executionArgs = [...executionRuntime.argsPrefix, ...args];
            const jobId = `debug:${node.id}:${Date.now()}`;

            logger.info(
                {
                    nodeId: node.id,
                    binaryObjectPath,
                    args: executionArgs,
                    outputDir: preparedEnvironment.outputDir
                },
                '@debug-entrypoint-executor: executing plugin entrypoint'
            );

            const processResult = await this.binaryExecutorService.executeProcess({
                jobId,
                commandPath: executionRuntime.commandPath,
                args: executionArgs,
                cwd: preparedEnvironment.outputDir,
                env: executionRuntime.env,
                timeoutMs: typeof normalizedEntrypointData.timeout === 'number' && Number.isFinite(normalizedEntrypointData.timeout)
                    ? normalizedEntrypointData.timeout
                    : undefined,
                logSink
            });
            const outputFiles = await fs.readdir(preparedEnvironment.outputDir).catch(() => []);

            return {
                dumpPath: preparedEnvironment.dumpPath,
                outputDir: preparedEnvironment.outputDir,
                output: {
                    binaryObjectPath,
                    commandPath: executionRuntime.commandPath,
                    artifactPath: executionRuntime.artifactPath,
                    args: executionArgs,
                    resolvedArguments,
                    dumpPath: preparedEnvironment.dumpPath,
                    outputPath: preparedEnvironment.outputDir,
                    projectPath: executionRuntime.projectPath ?? '',
                    outputFiles,
                    exitCode: processResult.code,
                    stdout: processResult.stdout,
                    stderr: processResult.stderr
                }
            };
        } catch (error) {
            if (previousNodeOutput) {
                context.outputs.set(node.id, previousNodeOutput);
            } else {
                context.outputs.delete(node.id);
            }
            throw error;
        }
    }
}
