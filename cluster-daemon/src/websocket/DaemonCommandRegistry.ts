import {
    clearJobsHistory,
    preprocessTrajectory,
    rasterizeTrajectory,
    removeRunningJobs,
    retryJobs,
    startAnalysis,
    syncPluginBinary,
    uploadObject
} from '../core/runtimeActions';
import { RuntimeLifecycleEventType } from '../contracts/events';
import { DockerRuntimeService } from '../infrastructure/docker/DockerRuntimeService';
import { RuntimeEventBroker } from '../infrastructure/RuntimeEventBroker';
import { MinioService } from '../infrastructure/minio/MinioService';
import { NotebookRepository } from '../infrastructure/mongo/repositories/NotebookRepository';
import { PluginListingRepository } from '../infrastructure/mongo/repositories/PluginListingRepository';
import { QueueService } from '../infrastructure/redis/QueueService';
import { RedisConnectionService } from '../infrastructure/redis/RedisConnectionService';
import { JupyterRuntimeService } from '../modules/jupyter/JupyterRuntimeService';
import { FilterEvaluatorService } from '../modules/native/FilterEvaluatorService';
import { GlbExporterService } from '../modules/native/GlbExporterService';
import { RasterizerService } from '../modules/native/RasterizerService';
import { TrajectoryParserService } from '../modules/native/TrajectoryParserService';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { DaemonConfig } from '../core/config';
import type { ReverseChannelSocketBridge } from './ReverseChannelSocketBridge';

interface DaemonCommandRegistryDependencies {
    config: DaemonConfig;
    eventBroker: RuntimeEventBroker;
    dockerRuntimeService: DockerRuntimeService;
    jupyterRuntimeService: JupyterRuntimeService;
    minioService: MinioService;
    notebookRepository: NotebookRepository;
    pluginListingRepository: PluginListingRepository;
    queueService: QueueService;
    redisConnectionService: RedisConnectionService;
    trajectoryParserService: TrajectoryParserService;
    glbExporterService: GlbExporterService;
    rasterizerService: RasterizerService;
    filterEvaluatorService: FilterEvaluatorService;
};

const readString = (value: unknown, fieldName: string): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${fieldName} is required`);
    }

    return value;
};

const readRecord = (value: unknown, fieldName: string): Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`${fieldName} must be an object`);
    }

    const record: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
        record[key] = entryValue;
    }

    return record;
};

const toPayloadRecord = (value: Record<string, unknown> | undefined): Record<string, unknown> => {
    const emptyRecord: Record<string, unknown> = {};
    return value || emptyRecord;
};

export const registerDaemonCommands = (
    bridge: ReverseChannelSocketBridge,
    dependencies: DaemonCommandRegistryDependencies
): void => {
    bridge.registerHandler({
        command: 'analysis.start',
        execute: async (payload) => {
            await startAnalysis(payload as never, dependencies.queueService, dependencies.redisConnectionService, dependencies.eventBroker);
            return { data: { queued: true } };
        }
    });

    bridge.registerHandler({
        command: 'queue.dispatch',
        execute: async (payload) => {
            const body = readRecord(toPayloadRecord(payload), 'payload');
            await dependencies.queueService.enqueue(readString(body.queueName, 'queueName'), readRecord(body.payload, 'payload'));
            return { data: { queued: true } };
        }
    });

    bridge.registerHandler({
        command: 'jobs.list',
        execute: async (payload) => {
            const body = readRecord(toPayloadRecord(payload), 'payload');
            const jobs = await dependencies.redisConnectionService.getTeamJobs(readString(body.teamId, 'teamId'));
            return {
                data: {
                    data: jobs.map((job) => ({
                        createdAt: typeof job.createdAt === 'string' ? job.createdAt : new Date().toISOString(),
                        updatedAt: typeof job.updatedAt === 'string' ? job.updatedAt : new Date().toISOString(),
                        ...job
                    }))
                }
            };
        }
    });

    bridge.registerHandler({
        command: 'jobs.retry',
        execute: async (payload) => ({ data: await retryJobs(payload as never, dependencies.queueService, dependencies.redisConnectionService) })
    });

    bridge.registerHandler({
        command: 'jobs.remove-running',
        execute: async (payload) => ({ data: await removeRunningJobs(payload as never, dependencies.queueService, dependencies.redisConnectionService) })
    });

    bridge.registerHandler({
        command: 'jobs.clear-history',
        execute: async (payload) => ({ data: await clearJobsHistory(payload as never, dependencies.redisConnectionService) })
    });

    bridge.registerHandler({
        command: 'trajectory.rasterize',
        execute: async (payload) => ({ data: await rasterizeTrajectory(payload as never, dependencies.minioService, dependencies.rasterizerService) })
    });

    bridge.registerHandler({
        command: 'object.upload',
        execute: async (payload) => {
            await uploadObject(payload as never, dependencies.minioService, dependencies.eventBroker);
            return { data: { uploaded: true } };
        }
    });

    bridge.registerHandler({
        command: 'object.list',
        execute: async (payload) => {
            const body = readRecord(toPayloadRecord(payload), 'payload');
            const keys = await dependencies.minioService.listObjects(readString(body.bucket, 'bucket'), typeof body.prefix === 'string' ? body.prefix : '');
            return { data: { keys } };
        }
    });

    bridge.registerHandler({
        command: 'object.get',
        execute: async (payload) => {
            const body = readRecord(toPayloadRecord(payload), 'payload');
            const bucket = readString(body.bucket, 'bucket');
            const objectKey = readString(body.objectKey, 'objectKey');
            const stat = await dependencies.minioService.statObject(bucket, objectKey);
            const nodeStream = await dependencies.minioService.getObjectStream(bucket, objectKey);
            const stream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
            const headers: Record<string, string> = {
                'content-length': String(stat.size)
            };
            if (typeof stat.metaData['content-type'] === 'string') {
                headers['content-type'] = stat.metaData['content-type'];
            }

            return {
                status: 200,
                headers,
                stream
            };
        }
    });

    bridge.registerHandler({
        command: 'plugin.sync',
        execute: async (payload) => ({ data: await syncPluginBinary(payload as never, dependencies.minioService, dependencies.eventBroker) })
    });

    bridge.registerHandler({
        command: 'plugin.listings.list',
        execute: async (payload) => ({ data: await dependencies.pluginListingRepository.listPluginListings(payload as never) })
    });

    bridge.registerHandler({
        command: 'plugin.sub-listings.list',
        execute: async (payload) => ({ data: await dependencies.pluginListingRepository.listPluginSubListings(payload as never) })
    });

    bridge.registerHandler({
        command: 'trajectory.native.preprocess',
        execute: async (payload) => {
            await dependencies.glbExporterService.preprocessTrajectory(payload as never);
            return { data: { processed: true } };
        }
    });

    bridge.registerHandler({ command: 'trajectory.native.metadata', execute: async (payload) => ({ data: await dependencies.trajectoryParserService.getTrajectoryMetadata(payload as never) }) });
    bridge.registerHandler({ command: 'trajectory.native.property-stats', execute: async (payload) => ({ data: await dependencies.trajectoryParserService.getPropertyStats(payload as never) }) });
    bridge.registerHandler({ command: 'trajectory.native.unique-values', execute: async (payload) => ({ data: await dependencies.trajectoryParserService.getUniqueValues(payload as never) }) });
    bridge.registerHandler({ command: 'trajectory.native.atoms', execute: async (payload) => ({ data: await dependencies.trajectoryParserService.getAtomsPage(payload as never) }) });
    bridge.registerHandler({ command: 'trajectory.native.filter-preview', execute: async (payload) => ({ data: await dependencies.filterEvaluatorService.previewFilter(payload as never) }) });
    bridge.registerHandler({ command: 'trajectory.native.color-model', execute: async (payload) => ({ data: await dependencies.filterEvaluatorService.exportColoredModel(payload as never) }) });
    bridge.registerHandler({ command: 'trajectory.native.particle-filter-model', execute: async (payload) => ({ data: await dependencies.filterEvaluatorService.exportParticleFilterModel(payload as never) }) });

    bridge.registerHandler({
        command: 'container.list',
        execute: async (payload) => {
            const all = typeof payload?.all === 'boolean' ? payload.all : true;
            return { data: await dependencies.dockerRuntimeService.listContainers(all) };
        }
    });
    bridge.registerHandler({ command: 'container.create', execute: async (payload) => ({ data: await dependencies.dockerRuntimeService.createContainer(payload as never), status: 201 }) });
    bridge.registerHandler({ command: 'container.get', execute: async (payload) => ({ data: await dependencies.dockerRuntimeService.getContainer(readString(payload?.containerId, 'containerId')) }) });
    bridge.registerHandler({ command: 'container.update', execute: async (payload) => ({ data: await dependencies.dockerRuntimeService.applyContainerAction(readString(payload?.containerId, 'containerId'), payload?.action as never) }) });
    bridge.registerHandler({ command: 'container.delete', execute: async (payload) => { await dependencies.dockerRuntimeService.deleteContainer(readString(payload?.containerId, 'containerId')); return { data: { deleted: true } }; } });
    bridge.registerHandler({ command: 'container.stats.get', execute: async (payload) => ({ data: await dependencies.dockerRuntimeService.getContainerStats(readString(payload?.containerId, 'containerId')) }) });
    bridge.registerHandler({ command: 'container.processes.list', execute: async (payload) => ({ data: await dependencies.dockerRuntimeService.getContainerProcesses(readString(payload?.containerId, 'containerId')) }) });
    bridge.registerHandler({ command: 'container.files.list', execute: async (payload) => ({ data: await dependencies.dockerRuntimeService.getContainerFiles(readString(payload?.containerId, 'containerId'), typeof payload?.path === 'string' ? payload.path : '/') }) });
    bridge.registerHandler({ command: 'container.file.read', execute: async (payload) => ({ data: { contents: await dependencies.dockerRuntimeService.readContainerFile(readString(payload?.containerId, 'containerId'), readString(payload?.path, 'path')) } }) });
    bridge.registerHandler({ command: 'container.file.write', execute: async (payload) => { await dependencies.dockerRuntimeService.writeContainerFile(readString(payload?.containerId, 'containerId'), readString(payload?.path, 'path'), readString(payload?.content, 'content')); return { data: { written: true } }; } });

    bridge.registerHandler({ command: 'notebook.create', execute: async (payload) => ({ data: await dependencies.notebookRepository.createNotebook(payload as never), status: 201 }) });
    bridge.registerHandler({ command: 'notebook.delete', execute: async (payload) => { const notebookId = readString(payload?.notebookId, 'notebookId'); await dependencies.jupyterRuntimeService.deleteSession(notebookId); return { data: { deleted: await dependencies.notebookRepository.deleteNotebook(notebookId) } }; } });
    bridge.registerHandler({ command: 'notebook.runtime.get', execute: async (payload) => ({ data: { hostPort: await dependencies.jupyterRuntimeService.getRuntimeHostPort(readString(payload?.notebookId, 'notebookId')) } }) });
    bridge.registerHandler({
        command: 'notebook.session.create',
        execute: async (payload) => {
            const notebookId = readString(payload?.notebookId, 'notebookId');
            const notebook = await dependencies.notebookRepository.getNotebookById(notebookId);
            if (!notebook) {
                throw new Error('Notebook not found');
            }

            return {
                data: await dependencies.jupyterRuntimeService.ensureSession({
                    notebook,
                    requestedBy: readString(payload?.requestedBy, 'requestedBy')
                }),
                status: 201
            };
        }
    });

    bridge.registerHandler({
        command: 'notebook.proxy.http',
        execute: async (payload) => {
            const notebookId = readString(payload?.notebookId, 'notebookId');
            const hostPort = await dependencies.jupyterRuntimeService.getRuntimeHostPort(notebookId);
            if (!hostPort) {
                throw new Error('Jupyter runtime is not available');
            }

            const proxiedPath = typeof payload?.proxiedPath === 'string' ? payload.proxiedPath : '/';
            const rawQuery = typeof payload?.rawQuery === 'string' ? payload.rawQuery : '';
            const targetUrl = `http://127.0.0.1:${hostPort}${proxiedPath}${rawQuery}`;
            const headers = typeof payload?.headers === 'object' && payload.headers !== null ? payload.headers as Record<string, string> : undefined;
            const response = await fetch(targetUrl, {
                method: typeof payload?.method === 'string' ? payload.method : 'GET',
                headers,
                body: typeof payload?.body === 'object' && payload.body !== null ? JSON.stringify(payload.body) : undefined
            });
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            return {
                status: response.status,
                headers: responseHeaders,
                stream: response.body || undefined
            };
        }
    });

    bridge.registerHandler({
        command: 'runtime.uninstall',
        execute: async () => {
            dependencies.eventBroker.emitLifecycle({
                type: RuntimeLifecycleEventType.UninstallRequested,
                teamClusterId: dependencies.config.teamClusterId,
                timestamp: new Date().toISOString(),
                connectedToCloud: true,
                details: 'Remote uninstall requested'
            });

            setTimeout(async () => {
                try {
                    if (dependencies.config.composeProjectName) {
                        await dependencies.dockerRuntimeService.removeComposeProject(dependencies.config.composeProjectName);
                    }

                    if (dependencies.config.installRoot) {
                        const installDirectory = path.join(dependencies.config.installRoot, dependencies.config.teamClusterId);
                        await fs.rm(installDirectory, {
                            recursive: true,
                            force: true
                        });
                    }

                    process.exit(0);
                } catch {
                }
            }, 250);

            return { data: { accepted: true } };
        }
    });
};
