import { logger } from '../../core/logger';
import { DAEMON_PATHS } from '../../core/paths';
import { MinioService } from '../../infrastructure/minio/MinioService';
import { RedisConnectionService } from '../../infrastructure/redis/RedisConnectionService';
import { QueueService } from '../../infrastructure/redis/QueueService';
import { BinaryExecutorService } from './BinaryExecutorService';
import { PluginBinaryCacheService } from './PluginBinaryCacheService';
import { ResultProcessorService } from './ResultProcessorService';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import type { AnalysisJobExecutionData } from '../../contracts/http';
import type { Job as BullMQJob, Worker } from 'bullmq';
import type { Readable } from 'node:stream';

const QUEUE_NAME = 'analysis_processing';
const DUMPS_BUCKET = 'volt-dumps';

interface QueueJobPayload extends Record<string, unknown> {
    jobId: string;
    teamId: string;
    status: string;
    queueType: string;
    metadata?: Record<string, unknown>;
    executionData: AnalysisJobExecutionData;
    createdAt: string;
    updatedAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const resolveTemplate = (template: string, outputs: Map<string, Record<string, unknown>>): string => {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, ref: string) => {
        const parts = ref.trim().split('.');
        const nodeId = parts[0];
        const propertyPath = parts.slice(1);
        const nodeOutput = outputs.get(nodeId);

        if (!nodeOutput) {
            logger.warn(`Template resolution failed: node "${nodeId}" not found in outputs`);
            return '';
        }

        if (propertyPath.length === 0) {
            return String(nodeOutput);
        }

        let current: unknown = nodeOutput;
        for (const key of propertyPath) {
            if (!isRecord(current)) {
                return '';
            }
            current = current[key];
        }

        return current !== undefined ? String(current) : '';
    });
};

const parseArguments = (value: string): string[] => {
    if (!value) {
        return [];
    }

    const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
    return [...value.matchAll(regex)].map((match) => match[1] ?? match[2] ?? match[3]);
};

export class AnalysisWorker {
    private running = false;
    private worker: Worker<QueueJobPayload> | null = null;

    constructor(
        private readonly queueService: QueueService,
        private readonly redisConnectionService: RedisConnectionService,
        private readonly minioService: MinioService,
        private readonly pluginBinaryCacheService: PluginBinaryCacheService,
        private readonly binaryExecutorService: BinaryExecutorService,
        private readonly resultProcessorService: ResultProcessorService
    ) {
    }

    start(): void {
        if (this.running) {
            return;
        }

        this.running = true;
        this.worker = this.queueService.createWorker<QueueJobPayload>(
            QUEUE_NAME,
            async (jobPayload, job) => this.processJob(jobPayload, job)
        );

        this.worker.on('failed', (job, error) => {
            logger.error(
                {
                    jobId: job?.data?.jobId,
                    err: error
                },
                'BullMQ analysis job failed'
            );
        });

        logger.info('AnalysisWorker started');
    }

    async stop(): Promise<void> {
        this.running = false;
        if (this.worker) {
            await this.worker.close();
            this.worker = null;
        }

        logger.info('AnalysisWorker stopped');
    }

    private async processJob(job: QueueJobPayload, bullJob: BullMQJob<QueueJobPayload>): Promise<void> {
        const { executionData } = job;
        const metadata = job.metadata || {};
        const forEachItem = isRecord(metadata.forEachItem) ? metadata.forEachItem : {};
        const forEachIndex = typeof metadata.forEachIndex === 'number' ? metadata.forEachIndex : 0;
        const timestep = typeof metadata.timestep === 'number' ? metadata.timestep : 0;
        const inputFile = typeof metadata.inputFile === 'string' ? metadata.inputFile : '';
        const runningTimestamp = new Date().toISOString();

        try {
            await this.redisConnectionService.projectJobStatus({
                ...job,
                status: 'running',
                updatedAt: runningTimestamp,
                timestamp: runningTimestamp
            });

            const binaryPath = await this.pluginBinaryCacheService.getBinaryPath(
                executionData.binaryObjectPath,
                executionData.binaryFileName
            );
            const dumpLocalPath = await this.downloadDump(inputFile);
            const outputDir = path.join(DAEMON_PATHS.analysisOutput, `${executionData.analysisId}-${forEachIndex}-${Date.now()}`);
            await fs.mkdir(outputDir, { recursive: true });

            const outputs = this.buildOutputsMap(executionData, forEachItem, forEachIndex, dumpLocalPath, outputDir);
            const resolvedArgs = resolveTemplate(executionData.arguments, outputs);
            const args = parseArguments(resolvedArgs);

            logger.info(
                {
                    jobId: job.jobId,
                    binary: path.basename(binaryPath),
                    args
                },
                'Executing plugin binary'
            );

            await bullJob.updateProgress(10);
            const result = await this.binaryExecutorService.executeProcess(job.jobId, binaryPath, args, outputDir);
            if (result.code !== 0) {
                throw new Error(`Binary exited with code ${result.code}: ${result.stderr || result.stdout}`);
            }

            logger.info({ jobId: job.jobId, exitCode: result.code }, 'Binary execution completed');
            await bullJob.updateProgress(70);

            for (const exposure of executionData.exposures) {
                await this.resultProcessorService.processExposureResult(
                    executionData,
                    exposure,
                    outputDir,
                    timestep,
                    job.teamId
                );
            }

            await bullJob.updateProgress(95);

            const completedTimestamp = new Date().toISOString();
            await this.redisConnectionService.projectJobStatus({
                ...job,
                status: 'completed',
                updatedAt: completedTimestamp,
                timestamp: completedTimestamp
            });

            await this.cleanup(dumpLocalPath, outputDir);

            logger.info({ jobId: job.jobId }, 'Job completed successfully');
            await bullJob.updateProgress(100);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error({ jobId: job.jobId, err: error }, `Job failed: ${message}`);

            const failedTimestamp = new Date().toISOString();
            await this.redisConnectionService.projectJobStatus({
                ...job,
                status: 'failed',
                error: message,
                updatedAt: failedTimestamp,
                timestamp: failedTimestamp
            });

            throw error instanceof Error ? error : new Error(message);
        }
    }

    private buildOutputsMap(
        executionData: AnalysisJobExecutionData,
        forEachItem: Record<string, unknown>,
        forEachIndex: number,
        dumpLocalPath: string,
        outputDir: string
    ): Map<string, Record<string, unknown>> {
        const outputs = new Map<string, Record<string, unknown>>();

        for (const [nodeId, nodeOutput] of Object.entries(executionData.nodeOutputSnapshots)) {
            outputs.set(nodeId, { ...nodeOutput });
        }

        const forEachOutput = outputs.get(executionData.forEachNodeId) || {};
        forEachOutput.currentValue = {
            ...forEachItem,
            path: dumpLocalPath
        };
        forEachOutput.currentIndex = forEachIndex;
        forEachOutput.outputPath = outputDir;
        outputs.set(executionData.forEachNodeId, forEachOutput);

        return outputs;
    }

    private async downloadDump(objectKey: string): Promise<string> {
        if (!objectKey) {
            throw new Error('No dump file path specified in job metadata');
        }

        const normalizedObjectKey = objectKey.startsWith('/')
            ? objectKey.slice(1)
            : objectKey;

        if (!normalizedObjectKey.endsWith('.dump.gz')) {
            throw new Error(`Invalid dump object key received: ${objectKey}`);
        }

        const fileName = path.basename(normalizedObjectKey);
        const localFileName = fileName.endsWith('.gz')
            ? fileName.slice(0, -3)
            : fileName;
        const localPath = path.join(DAEMON_PATHS.analysisDumps, `${localFileName}-${Date.now()}`);
        await fs.mkdir(path.dirname(localPath), { recursive: true });

        const stream = await this.minioService.getObjectStream(DUMPS_BUCKET, normalizedObjectKey);
        await this.writeStreamToFile(stream, localPath, normalizedObjectKey.endsWith('.gz'));

        logger.info(`Dump downloaded: ${normalizedObjectKey} -> ${localPath}`);
        return localPath;
    }

    private async cleanup(dumpPath: string, outputDir: string): Promise<void> {
        const tasks = [
            fs.rm(dumpPath, { force: true }).catch(() => {}),
            fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
        ];

        try {
            const parentDir = path.dirname(outputDir);
            const baseName = path.basename(outputDir);
            const entries = await fs.readdir(parentDir);
            for (const entry of entries) {
                if (entry.startsWith(`${baseName}_`)) {
                    tasks.push(fs.rm(path.join(parentDir, entry), { recursive: true, force: true }).catch(() => {}));
                }
            }
        } catch {
        }

        await Promise.all(tasks);
    }

    private writeStreamToFile(stream: Readable, filePath: string, decompressGzip: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.on('end', async () => {
                try {
                    const buffer = Buffer.concat(chunks);
                    const output = decompressGzip ? zlib.gunzipSync(buffer) : buffer;
                    await fs.writeFile(filePath, output);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
            stream.on('error', reject);
        });
    }
};
