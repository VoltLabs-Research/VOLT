import { AnalysisJobExecutionData, AnalysisExposureDefinition } from '../contracts/http';
import { DaemonConfig } from '../config/env';
import { LocalMinioService } from './LocalMinioService';
import { LocalMongoService } from './LocalMongoService';
import { LocalRedisService } from './LocalRedisService';
import { PluginBinaryCacheService } from './PluginBinaryCacheService';
import { VoltCloudConnection } from './VoltCloudConnection';
import { logger } from './logger';
import { Decoder } from '@msgpack/msgpack';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

const QUEUE_NAME = 'analysis_processing';
const PLUGINS_BUCKET = 'volt-plugins';
const DUMPS_BUCKET = 'volt-dumps';
const BLPOP_TIMEOUT_SECONDS = 5;

interface QueueJobPayload {
    jobId: string;
    teamId: string;
    status: string;
    queueType: string;
    metadata?: Record<string, unknown>;
    executionData: AnalysisJobExecutionData;
    createdAt: string;
    updatedAt: string;
};

interface ProcessResult {
    code: number;
    stdout: string;
    stderr: string;
};

interface TimestepRecord {
    timestep: number;
    mainListing: Record<string, unknown>;
    subListings: Record<string, Array<Record<string, unknown>>>;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const shouldIgnoreValue = (value: unknown): boolean => {
    return Array.isArray(value) && value.length >= 1 && Array.isArray(value[0]);
};

const cleanSubListingRows = (
    rawRows: Array<Record<string, unknown>>
): Array<Record<string, unknown>> => {
    if (rawRows.length === 0) {
        return [];
    }

    const firstRow = rawRows[0];
    const validKeys = Object.keys(firstRow).filter(
        (key) => !shouldIgnoreValue(firstRow[key])
    );

    return rawRows.map((rawRow) => {
        const cleaned: Record<string, unknown> = {};
        for (const key of validKeys) {
            cleaned[key] = rawRow[key];
        }
        return cleaned;
    });
};

/**
 * Merges partial data chunks (arrays or objects) into a single structure.
 * Ported from server's merge-chunked-value.ts.
 */
const mergeChunkedValue = (target: unknown, incoming: unknown): unknown => {
    if (incoming === null) return target;
    if (target === null) return incoming;

    if (Array.isArray(target) && Array.isArray(incoming)) {
        target.push(...incoming);
        return target;
    }

    if (isRecord(target) && isRecord(incoming)) {
        for (const [key, incomingValue] of Object.entries(incoming)) {
            const targetValue = target[key];

            if (Array.isArray(targetValue) && Array.isArray(incomingValue)) {
                targetValue.push(...incomingValue);
            } else if (isRecord(targetValue) && isRecord(incomingValue)) {
                target[key] = mergeChunkedValue(targetValue, incomingValue);
            } else {
                target[key] = incomingValue;
            }
        }
        return target;
    }

    return incoming;
};

/**
 * Decodes a multi-message msgpack stream. Ported from server's msgpack.ts.
 */
async function* decodeMultiStream(
    src: AsyncIterable<Uint8Array | Buffer>
): AsyncIterable<unknown> {
    const decoder = new Decoder<unknown>();
    const byteSrc = (async function* () {
        for await (const chunk of src) {
            yield chunk;
        }
    })();

    for await (const value of decoder.decodeStream(byteSrc)) {
        yield value;
    }
}

/**
 * Resolves a template string like "{{ nodeId.property.path }}" using a Map of node outputs.
 * Mirrors the server's NodeRegistry.resolveTemplate / resolveReference.
 */
const resolveTemplate = (
    template: string,
    outputs: Map<string, Record<string, unknown>>
): string => {
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
            current = (current as Record<string, unknown>)[key];
        }

        return current !== undefined ? String(current) : '';
    });
};

/**
 * Shell-style argument tokenizer. Mirrors server's EntrypointHandler.parseArguments.
 */
const parseArguments = (str: string): string[] => {
    if (!str) return [];
    const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
    return [...str.matchAll(regex)].map((m) => m[1] ?? m[2] ?? m[3]);
};

export class AnalysisWorkerService {
    private running = false;
    private loopPromise: Promise<void> | null = null;

    constructor(
        private readonly config: DaemonConfig,
        private readonly redisService: LocalRedisService,
        private readonly minioService: LocalMinioService,
        private readonly mongoService: LocalMongoService,
        private readonly binaryCacheService: PluginBinaryCacheService,
        private readonly voltCloudConnection: VoltCloudConnection
    ) {
    }

    start(): void {
        if (this.running) {
            return;
        }

        this.running = true;
        this.loopPromise = this.workerLoop();
        logger.info('AnalysisWorkerService started');
    }

    async stop(): Promise<void> {
        this.running = false;
        if (this.loopPromise) {
            await this.loopPromise;
            this.loopPromise = null;
        }

        logger.info('AnalysisWorkerService stopped');
    }

    private async workerLoop(): Promise<void> {
        while (this.running) {
            try {
                const job = await this.redisService.dequeue<QueueJobPayload>(
                    QUEUE_NAME,
                    BLPOP_TIMEOUT_SECONDS
                );

                if (!job) {
                    continue;
                }

                logger.info({ jobId: job.jobId }, 'Dequeued analysis job');
                await this.processJob(job);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                logger.error({ err: error }, `Worker loop error: ${message}`);
                // Brief pause to avoid tight error loops
                await this.sleep(1000);
            }
        }
    }

    private async processJob(job: QueueJobPayload): Promise<void> {
        const { executionData } = job;
        const metadata = job.metadata || {};
        const forEachItem = isRecord(metadata.forEachItem) ? metadata.forEachItem : {};
        const forEachIndex = typeof metadata.forEachIndex === 'number' ? metadata.forEachIndex : 0;
        const timestep = typeof metadata.timestep === 'number' ? metadata.timestep : 0;
        const inputFile = typeof metadata.inputFile === 'string' ? metadata.inputFile : '';

        try {
            // 1. Download binary
            const binaryPath = await this.binaryCacheService.getBinaryPath(
                executionData.binaryObjectPath,
                executionData.binaryFileName
            );

            // 2. Download dump file to a temp location
            const dumpLocalPath = await this.downloadDump(inputFile);

            // 3. Create output directory
            const outputDir = `/tmp/analysis-output/${executionData.analysisId}-${forEachIndex}-${Date.now()}`;
            await fs.mkdir(outputDir, { recursive: true });

            // 4. Build execution context outputs map for template resolution
            const outputs = this.buildOutputsMap(
                executionData,
                forEachItem,
                forEachIndex,
                dumpLocalPath,
                outputDir
            );

            // 5. Resolve arguments template and parse
            const resolvedArgs = resolveTemplate(executionData.arguments, outputs);
            const args = parseArguments(resolvedArgs);

            logger.info(
                { jobId: job.jobId, binary: path.basename(binaryPath), args },
                'Executing plugin binary'
            );

            // 6. Execute binary
            const result = await this.executeProcess(binaryPath, args, outputDir);

            if (result.code !== 0) {
                throw new Error(
                    `Binary exited with code ${result.code}: ${result.stderr || result.stdout}`
                );
            }

            logger.info({ jobId: job.jobId, exitCode: result.code }, 'Binary execution completed');

            // 7. For each exposure, upload .msgpack and precompute listings
            for (const exposure of executionData.exposures) {
                await this.processExposureResult(
                    executionData,
                    exposure,
                    outputDir,
                    timestep,
                    job.teamId
                );
            }

            // 8. Report success to VoltCloud server
            await this.reportJobCompletion(job.jobId, executionData.analysisId, job.teamId, true);

            // 9. Cleanup temp files
            await this.cleanup(dumpLocalPath, outputDir);

            logger.info({ jobId: job.jobId }, 'Job completed successfully');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error({ jobId: job.jobId, err: error }, `Job failed: ${message}`);
            await this.reportJobCompletion(
                job.jobId,
                executionData.analysisId,
                job.teamId,
                false,
                message
            );
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

        // Restore all pre-computed node outputs from planning phase
        for (const [nodeId, nodeOutput] of Object.entries(executionData.nodeOutputSnapshots)) {
            outputs.set(nodeId, { ...nodeOutput });
        }

        // Override the forEach node output with current iteration data
        // The forEach item's path is the MinIO object key, but the binary needs the local file path
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

        const fileName = path.basename(objectKey);
        const localPath = `/tmp/analysis-dumps/${fileName}-${Date.now()}`;
        await fs.mkdir(path.dirname(localPath), { recursive: true });

        const stream = await this.minioService.getObjectStream(DUMPS_BUCKET, objectKey);
        await this.writeStreamToFile(stream, localPath);

        logger.info(`Dump downloaded: ${objectKey} -> ${localPath}`);
        return localPath;
    }

    private executeProcess(binaryPath: string, args: string[], cwd: string): Promise<ProcessResult> {
        return new Promise((resolve, reject) => {
            const child = spawn(binaryPath, args, {
                cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: { ...process.env }
            });

            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];

            child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
            child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

            child.on('error', (error) => {
                reject(new Error(`Failed to spawn process: ${error.message}`));
            });

            child.on('close', (code) => {
                resolve({
                    code: code ?? 1,
                    stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
                    stderr: Buffer.concat(stderrChunks).toString('utf-8')
                });
            });
        });
    }

    private async processExposureResult(
        executionData: AnalysisJobExecutionData,
        exposure: AnalysisExposureDefinition,
        outputDir: string,
        timestep: number,
        teamId: string
    ): Promise<void> {
        // The output file is at: {outputDir}_{results suffix}
        // This mirrors how the server's ExposureHandler builds the path:
        //   `${item.outputPath}_${config.results}`
        const outputFilePath = `${outputDir}_${exposure.results}`;

        try {
            await fs.access(outputFilePath);
        } catch {
            logger.warn(
                { exposure: exposure.name, path: outputFilePath },
                'Exposure output file not found, skipping'
            );
            return;
        }

        // Upload .msgpack to daemon MinIO
        const storageKey = `plugins/trajectory-${executionData.trajectoryId}/analysis-${executionData.analysisId}/${exposure.nodeId}/timestep-${timestep}.msgpack`;
        const fileBuffer = await fs.readFile(outputFilePath);

        await this.minioService.putObject({
            bucket: PLUGINS_BUCKET,
            objectKey: storageKey,
            body: fileBuffer,
            metadata: { 'Content-Type': 'application/msgpack' }
        });

        logger.info({ storageKey }, 'Uploaded exposure .msgpack');

        // Decode and store listing rows
        await this.precomputeListingRows(
            executionData,
            exposure,
            storageKey,
            timestep,
            teamId
        );
    }

    private async precomputeListingRows(
        executionData: AnalysisJobExecutionData,
        exposure: AnalysisExposureDefinition,
        objectKey: string,
        timestep: number,
        teamId: string
    ): Promise<void> {
        const stream = await this.minioService.getObjectStream(PLUGINS_BUCKET, objectKey);
        const decoded = await this.readDecodedPayload(stream);

        if (!decoded) {
            logger.warn({ objectKey }, 'Failed to decode msgpack payload');
            return;
        }

        const mainListing = decoded.main_listing;
        if (!mainListing || typeof mainListing !== 'object' || Object.keys(mainListing as object).length === 0) {
            logger.warn({ objectKey }, 'Empty or missing main_listing in decoded payload');
            return;
        }

        // Delete existing sub-listing rows for this exposure+analysis (idempotent re-run)
        await this.mongoService.deleteSubListingRows({
            analysis: executionData.analysisId,
            exposureId: exposure.nodeId
        });

        // Extract sub-listings
        let subListings: Record<string, Array<Record<string, unknown>>> = {};
        const rawSubListings = decoded.sub_listings;
        if (rawSubListings && typeof rawSubListings === 'object') {
            const entries = Object.entries(rawSubListings as Record<string, unknown>);
            for (const [name, value] of entries) {
                if (Array.isArray(value) && value.length > 0) {
                    subListings[name] = value as Array<Record<string, unknown>>;
                }
            }
        }

        const subListingNames = Object.keys(subListings);

        // Upsert main listing row
        await this.mongoService.bulkUpsertListingRows([{
            filter: {
                analysis: executionData.analysisId,
                exposureId: exposure.nodeId,
                timestep
            },
            update: {
                plugin: executionData.pluginId,
                team: teamId,
                trajectory: executionData.trajectoryId,
                trajectoryName: '',
                analysis: executionData.analysisId,
                exposureName: exposure.name,
                exposureId: exposure.nodeId,
                timestep,
                row: mainListing,
                subListingNames
            }
        }]);

        // Insert sub-listing rows
        for (const [subListingName, rawRows] of Object.entries(subListings)) {
            const cleanedRows = cleanSubListingRows(rawRows);
            if (cleanedRows.length === 0) {
                continue;
            }

            const documents = cleanedRows.map((cleanedRow) => ({
                plugin: executionData.pluginId,
                team: teamId,
                trajectory: executionData.trajectoryId,
                analysis: executionData.analysisId,
                exposureId: exposure.nodeId,
                exposureName: exposure.name,
                timestep,
                subListingName,
                row: cleanedRow
            }));

            await this.mongoService.insertSubListingRows(documents);
        }

        logger.info(
            { exposure: exposure.name, timestep, subListingCount: subListingNames.length },
            'Listing rows precomputed'
        );
    }

    private async readDecodedPayload(stream: Readable): Promise<Record<string, unknown> | null> {
        const asyncIterable = (async function* () {
            for await (const chunk of stream) {
                yield chunk as Uint8Array | Buffer;
            }
        })();

        let decoded: Record<string, unknown> | null = null;
        for await (const message of decodeMultiStream(asyncIterable)) {
            if (isRecord(message)) {
                const mergedPayload = mergeChunkedValue(decoded, message);
                if (isRecord(mergedPayload)) {
                    decoded = mergedPayload;
                }
            }
        }

        return decoded;
    }

    private async reportJobCompletion(
        jobId: string,
        analysisId: string,
        teamId: string,
        success: boolean,
        error?: string
    ): Promise<void> {
        try {
            const url = `${this.config.voltCloudUrl}/api/v1/daemon/job-completion`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    daemonPassword: this.config.daemonPassword,
                    teamClusterId: this.config.teamClusterId,
                    jobId,
                    analysisId,
                    teamId,
                    success,
                    error
                })
            });

            if (!response.ok) {
                logger.warn(
                    { jobId, status: response.status },
                    'Failed to report job completion to VoltCloud server'
                );
            }
        } catch (reportError: unknown) {
            const message = reportError instanceof Error ? reportError.message : String(reportError);
            logger.warn({ jobId, err: reportError }, `Failed to report job completion: ${message}`);
        }
    }

    private async cleanup(dumpPath: string, outputDir: string): Promise<void> {
        const tasks = [
            fs.rm(dumpPath, { force: true }).catch(() => {}),
            fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
        ];

        // Also clean up any output files that match the pattern {outputDir}_*
        try {
            const parentDir = path.dirname(outputDir);
            const baseName = path.basename(outputDir);
            const entries = await fs.readdir(parentDir);
            for (const entry of entries) {
                if (entry.startsWith(`${baseName}_`)) {
                    tasks.push(
                        fs.rm(path.join(parentDir, entry), { recursive: true, force: true }).catch(() => {})
                    );
                }
            }
        } catch {
            // Parent dir may not exist
        }

        await Promise.all(tasks);
    }

    private writeStreamToFile(stream: Readable, filePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.on('end', async () => {
                try {
                    await fs.writeFile(filePath, Buffer.concat(chunks));
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
            stream.on('error', reject);
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
