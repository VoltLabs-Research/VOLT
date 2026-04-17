import { logger } from '@/core/logger';
import { DAEMON_PATHS } from '@/core/paths';
import { ObjectBucketName, VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@/core/storage/contracts/http.objectStore';
import { createZstdDecompressionStream } from '@/support/serialization/storage-codec';
import type { PluginBinaryCacheService } from '@/modules/plugin/application/binaries/PluginBinaryCacheService';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { executeWorkflowEntrypoint } from '@/modules/analysis/application/workflow/WorkflowEntrypointExecution';
import { applyLocalizedWorkflowDumpSelection, resolveWorkflowSelectedDump } from '@/modules/analysis/application/workflow/WorkflowTrajectoryState';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { dir as createTempDir } from 'tmp-promise';

type BinaryExecutorService = import('@/core/runtime/infrastructure/BinaryExecutorService').BinaryExecutorService;
type ProcessExecutionLogSink = import('@/core/runtime/infrastructure/BinaryExecutorService').ProcessExecutionLogSink;
type WorkflowExecutionContext = import('@/modules/analysis/contracts/workflow.types').WorkflowExecutionContext;
type WorkflowNode = import('@/modules/analysis/contracts/workflow.types').WorkflowNode;

interface DebugEntrypointExecutionResult {
    output: Awaited<ReturnType<typeof executeWorkflowEntrypoint>>;
    dumpPath: string;
    outputDir: string;
}

interface PreparedDebugExecutionDump {
    path: string;
    originalPath?: string;
    timestep: number;
    natoms: number;
    simulationCell: string;
}

export interface PreparedDebugExecutionEnvironment {
    selectedDump: PreparedDebugExecutionDump;
    selectedDumpIndex: number;
    dumpPath: string;
    outputDir: string;
}

const downloadDumpForDebugExecution = async (
    objectStore: ClusterObjectStore,
    objectKey: string,
    ownerClusterId: string
): Promise<string> => {
    const normalizedObjectKey = objectKey.startsWith('/')
        ? objectKey.slice(1)
        : objectKey;
    if (!normalizedObjectKey.endsWith('.dump.zst')) {
        throw new Error(`Invalid dump object key received: ${objectKey}`);
    }

    const fileName = basename(normalizedObjectKey);
    const localFileName = fileName.endsWith('.zst') ? fileName.slice(0, -4) : fileName;
    const localPath = join(DAEMON_PATHS.analysisDumps, `${localFileName}-${Date.now()}`);

    await mkdir(dirname(localPath), { recursive: true });

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

        const selectedDump = resolveWorkflowSelectedDump(context);
        if (!selectedDump) {
            throw new Error('No selected trajectory dump is available for debug execution');
        }

        const dumpPath = await downloadDumpForDebugExecution(
            this.objectStore,
            selectedDump.dump.path,
            resolvedStorageClusterId
        );
        await mkdir(DAEMON_PATHS.analysisOutput, { recursive: true });
        const outputDir = (await createTempDir({
            tmpdir: DAEMON_PATHS.analysisOutput,
            prefix: `debug-${sessionId}-`,
            unsafeCleanup: true
        })).path;

        applyLocalizedWorkflowDumpSelection(context, selectedDump, dumpPath, outputDir);

        return {
            selectedDump: selectedDump.dump,
            selectedDumpIndex: selectedDump.index,
            dumpPath,
            outputDir
        };
    }

    async executePrepared(
        node: WorkflowNode,
        context: WorkflowExecutionContext,
        preparedEnvironment: PreparedDebugExecutionEnvironment,
        logSink?: ProcessExecutionLogSink
    ): Promise<DebugEntrypointExecutionResult> {
        const entrypointData = node.data.entrypoint;
        if (!entrypointData) {
            throw new Error(`Entrypoint ${node.id} is missing runtime configuration`);
        }

        const { binaryObjectPath, arguments: argumentsTemplate } = entrypointData;

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
                nonZeroExitMessage: (result) => `Entrypoint exited with code ${result.code}: ${result.stderr || result.stdout}`,
                extraOutput: {
                    dumpPath: preparedEnvironment.dumpPath
                }
            })
        };
    }
}
