import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { EntrypointType, ObjectBucketName, VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@/shared/contracts';
import { createZstdDecompressionStream, stripZstdExtension } from '@/shared/utilities/storage-codec';
import { decodeCliArgumentsToken, isRecord } from '@/shared/utils';
import type { BinaryExecutorService } from '@/modules/job-runtime/services/BinaryExecutorService';
import type { PluginBinaryCacheService } from '@/modules/job-runtime/services/PluginBinaryCacheService';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import type { WorkflowExecutionContext, WorkflowNode } from '../contracts';
import { WorkflowNodeType } from '../contracts';
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

interface WorkflowEntrypointData {
    binaryObjectPath?: string;
    arguments?: string;
    timeout?: number;
    requirementsFile?: string;
    entrypointScript?: string;
    type?: string;
};

export interface DebugEntrypointExecutionResult {
    output: Record<string, unknown>;
    dumpPath: string;
    outputDir: string;
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

const parseArguments = (value: string): string[] => {
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
        const entrypointData = isRecord(node.data.entrypoint)
            ? node.data.entrypoint as WorkflowEntrypointData
            : undefined;
        const binaryObjectPath = typeof entrypointData?.binaryObjectPath === 'string'
            ? entrypointData.binaryObjectPath.trim()
            : '';
        const argumentsTemplate = typeof entrypointData?.arguments === 'string'
            ? entrypointData.arguments
            : '';

        if (!binaryObjectPath || !argumentsTemplate) {
            throw new Error(`Entrypoint ${node.id} is missing runtime configuration`);
        }

        const resolvedStorageClusterId = storageClusterId || VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID;
        if (!storageClusterId) {
            logger.warn(
                {
                    sessionId,
                    nodeId: node.id,
                    fallbackOwnerClusterId: resolvedStorageClusterId
                },
                '@debug-entrypoint-executor: missing trajectory storage cluster id, falling back to Volt server owner'
            );
        }

        const selectedDump = resolveSelectedDumpDescriptor(context);
        if (!selectedDump) {
            throw new Error('No selected trajectory dump is available for debug execution');
        }

        const normalizedEntrypointData = entrypointData ?? {};
        let dumpPath = '';
        let outputDir = '';

        try {
            dumpPath = await downloadDumpForDebugExecution(
                this.objectStore,
                selectedDump.path,
                resolvedStorageClusterId
            );
            outputDir = path.join(DAEMON_PATHS.analysisOutput, `debug-${sessionId}-${Date.now()}`);
            await fs.mkdir(outputDir, { recursive: true });

            updateContextOutputsForDebugExecution(context, selectedDump, dumpPath, outputDir);

            const executionRuntime = await this.pluginBinaryCacheService.getExecutionRuntime({
                binaryObjectPath,
                entrypointType: normalizedEntrypointData.type === EntrypointType.PythonScript
                    ? EntrypointType.PythonScript
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
            const resolvedArguments = resolveWorkflowTemplate(argumentsTemplate, context.outputs);
            const args = parseArguments(resolvedArguments);
            const executionArgs = [...executionRuntime.argsPrefix, ...args];
            const jobId = `${sessionId}:${node.id}`;

            logger.info(
                {
                    sessionId,
                    nodeId: node.id,
                    binaryObjectPath,
                    args: executionArgs,
                    outputDir
                },
                '@debug-entrypoint-executor: executing plugin entrypoint'
            );

            const processResult = await this.binaryExecutorService.executeProcess({
                jobId,
                commandPath: executionRuntime.commandPath,
                args: executionArgs,
                cwd: outputDir,
                env: executionRuntime.env,
                timeoutMs: typeof normalizedEntrypointData.timeout === 'number' && Number.isFinite(normalizedEntrypointData.timeout)
                    ? normalizedEntrypointData.timeout
                    : undefined
            });
            const outputFiles = await fs.readdir(outputDir).catch(() => []);

            return {
                dumpPath,
                outputDir,
                output: {
                    binaryObjectPath,
                    commandPath: executionRuntime.commandPath,
                    artifactPath: executionRuntime.artifactPath,
                    args: executionArgs,
                    resolvedArguments,
                    dumpPath,
                    outputPath: outputDir,
                    outputFiles,
                    exitCode: processResult.code,
                    stdout: processResult.stdout,
                    stderr: processResult.stderr
                }
            };
        } catch (error) {
            const cleanupTasks: Array<Promise<unknown>> = [];
            if (dumpPath) {
                cleanupTasks.push(fs.rm(dumpPath, { force: true }).catch(() => {}));
            }
            if (outputDir) {
                cleanupTasks.push(fs.rm(outputDir, { recursive: true, force: true }).catch(() => {}));
            }
            await Promise.all(cleanupTasks);
            throw error;
        }
    }
}
