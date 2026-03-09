import {
    AnalysisStartRequest,
    ContainerAction,
    DaemonHealthResponse,
    CreateContainerRequest,
    CreateNotebookRequest,
    CreateNotebookSessionRequest,
    NativeTrajectoryAtomsPageRequest,
    NativeTrajectoryColorModelRequest,
    NativeTrajectoryFilterPreviewRequest,
    NativeTrajectoryMetadataRequest,
    NativeTrajectoryParticleFilterModelRequest,
    NativeTrajectoryPropertyStatsRequest,
    NativeTrajectoryPreprocessRequest,
    NativeTrajectoryUniqueValuesRequest,
    ObjectBucketName,
    ObjectUploadRequest,
    PluginSyncRequest,
    QueueDispatchRequest,
    TextEncoding,
    TrajectoryPreprocessRequest,
    UninstallRequest,
    UpdateContainerRequest,
    UpdateNotebookRequest,
    WriteContainerFileRequest
} from '../contracts/http';
import { DaemonConfig } from '../config/env';
import { RuntimeLifecycleEvent, RuntimeLifecycleEventType } from '../contracts/events';
import { DockerRuntimeService } from '../services/DockerRuntimeService';
import { JupyterRuntimeService } from '../services/JupyterRuntimeService';
import { LocalMinioService } from '../services/LocalMinioService';
import { LocalMongoService } from '../services/LocalMongoService';
import { LocalRedisService } from '../services/LocalRedisService';
import { MetricsService } from '../services/MetricsService';
import { OrchestrationService } from '../services/OrchestrationService';
import { RuntimeEventBroker } from '../services/RuntimeEventBroker';
import { createDaemonAuthMiddleware } from './authenticateRequest';
import express from 'express';
import type { Request, Response } from 'express';

interface CreateAppDependencies {
    config: DaemonConfig;
    eventBroker: RuntimeEventBroker;
    dockerRuntimeService: DockerRuntimeService;
    jupyterRuntimeService: JupyterRuntimeService;
    minioService: LocalMinioService;
    mongoService: LocalMongoService;
    redisService: LocalRedisService;
    metricsService: MetricsService;
    orchestrationService: OrchestrationService;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readString = (value: unknown, fieldName: string): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${fieldName} must be a non-empty string`);
    }

    return value;
};

const readOptionalString = (value: unknown): string | undefined => {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value;
    }

    return undefined;
};

const readNumber = (value: unknown, fieldName: string): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${fieldName} must be a finite number`);
    }

    return value;
};

const readInteger = (value: unknown, fieldName: string): number => {
    const numberValue = readNumber(value, fieldName);
    if (!Number.isInteger(numberValue)) {
        throw new Error(`${fieldName} must be an integer`);
    }

    return numberValue;
};

const readRecord = (value: unknown, fieldName: string): Record<string, unknown> => {
    if (!isRecord(value)) {
        throw new Error(`${fieldName} must be an object`);
    }

    return value;
};

const readStringArray = (value: unknown, fieldName: string): string[] => {
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
        throw new Error(`${fieldName} must be an array of strings`);
    }

    return value;
};

const readAnalysisQueueJobs = (value: unknown): AnalysisStartRequest['payload']['jobs'] => {
    if (!Array.isArray(value)) {
        throw new Error('payload.jobs must be an array');
    }

    return value.map((entry, index) => {
        const job = readRecord(entry, `payload.jobs[${index}]`);

        return {
            jobId: readString(job.jobId, `payload.jobs[${index}].jobId`),
            teamId: readString(job.teamId, `payload.jobs[${index}].teamId`),
            sessionId: readOptionalString(job.sessionId),
            status: readString(job.status, `payload.jobs[${index}].status`),
            queueType: readString(job.queueType, `payload.jobs[${index}].queueType`),
            maxRetries: job.maxRetries === undefined ? undefined : readNumber(job.maxRetries, `payload.jobs[${index}].maxRetries`),
            metadata: job.metadata ? readRecord(job.metadata, `payload.jobs[${index}].metadata`) : undefined,
            completedAt: readOptionalString(job.completedAt),
            error: readOptionalString(job.error),
            startTime: readOptionalString(job.startTime),
            progress: job.progress === undefined ? undefined : readNumber(job.progress, `payload.jobs[${index}].progress`),
            message: readOptionalString(job.message),
            workerId: job.workerId === undefined ? undefined : readNumber(job.workerId, `payload.jobs[${index}].workerId`),
            createdAt: readString(job.createdAt, `payload.jobs[${index}].createdAt`),
            updatedAt: readString(job.updatedAt, `payload.jobs[${index}].updatedAt`)
        };
    });
};

const readBucket = (value: unknown): ObjectBucketName => {
    const bucket = readString(value, 'bucket');
    const bucketValues = Object.values(ObjectBucketName);
    for (const allowedBucket of bucketValues) {
        if (allowedBucket === bucket) {
            return allowedBucket;
        }
    }

    throw new Error('Bucket is not allowed');
};

const readContainerAction = (value: unknown): ContainerAction => {
    const action = readString(value, 'action');
    const actionValues = Object.values(ContainerAction);
    for (const candidateAction of actionValues) {
        if (candidateAction === action) {
            return candidateAction;
        }
    }

    throw new Error('Unsupported container action');
};

const readTextEncoding = (value: unknown): TextEncoding | undefined => {
    const encoding = readOptionalString(value);
    if (!encoding) {
        return undefined;
    }

    const encodings = Object.values(TextEncoding);
    for (const candidateEncoding of encodings) {
        if (candidateEncoding === encoding) {
            return candidateEncoding;
        }
    }

    throw new Error('Unsupported encoding');
};

const readParticleFilterAction = (value: unknown): 'delete' | 'highlight' => {
    const action = readString(value, 'action');
    if (action === 'delete' || action === 'highlight') {
        return action;
    }

    throw new Error('Unsupported particle filter action');
};

const readStringRecord = (value: unknown, fieldName: string): Record<string, string> => {
    const record = readRecord(value, fieldName);
    const result: Record<string, string> = {};

    for (const [key, recordValue] of Object.entries(record)) {
        if (typeof recordValue !== 'string') {
            throw new Error(`${fieldName}.${key} must be a string`);
        }

        result[key] = recordValue;
    }

    return result;
};

const readNativeTrajectoryRequest = (value: unknown): NativeTrajectoryMetadataRequest => {
    const payload = readRecord(value, 'body');

    return {
        trajectoryId: readString(payload.trajectoryId, 'trajectoryId'),
        timestep: readInteger(payload.timestep, 'timestep'),
        objectKey: readOptionalString(payload.objectKey)
    };
};

const sendSuccess = <T>(res: Response, data: T, statusCode: number = 200): void => {
    res.status(statusCode).json({
        status: 'success',
        data
    });
};

const sendError = (res: Response, error: unknown): void => {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    res.status(400).json({
        status: 'error',
        message
    });
};

const copyHeaders = (sourceHeaders: Headers, res: Response): void => {
    sourceHeaders.forEach((value, key) => {
        if (key.toLowerCase() === 'transfer-encoding') {
            return;
        }

        res.setHeader(key, value);
    });
};

const readProxyRequestBody = (req: Request): BodyInit | undefined => {
    if (req.method === 'GET' || req.method === 'HEAD') {
        return undefined;
    }

    if (typeof req.body === 'string') {
        return req.body;
    }

    if (Buffer.isBuffer(req.body)) {
        return new Uint8Array(req.body);
    }

    if (req.body && typeof req.body === 'object') {
        return JSON.stringify(req.body);
    }

    return undefined;
};

const isDaemonReady = (latestLifecycleEvent: RuntimeLifecycleEvent | null): boolean => {
    if (!latestLifecycleEvent) {
        return false;
    }

    return latestLifecycleEvent.type === RuntimeLifecycleEventType.ServicesReady
        || latestLifecycleEvent.type === RuntimeLifecycleEventType.HeartbeatSucceeded
        || latestLifecycleEvent.type === RuntimeLifecycleEventType.HeartbeatFailed
        || latestLifecycleEvent.type === RuntimeLifecycleEventType.CloudSocketConnected
        || latestLifecycleEvent.type === RuntimeLifecycleEventType.CloudSocketDisconnected;
};

export const createApp = (dependencies: CreateAppDependencies) => {
    const app = express();
    app.use(express.json({ limit: '50mb' }));

    app.get('/health', async (_req, res) => {
        const metrics = await dependencies.metricsService.collectSnapshot();
        const latestLifecycleEvent = dependencies.eventBroker.getLatestLifecycleEvent();
        const response: DaemonHealthResponse = {
            ok: true,
            ready: isDaemonReady(latestLifecycleEvent),
            metrics,
            latestLifecycleEvent
        };

        sendSuccess(res, response);
    });

    app.use(createDaemonAuthMiddleware(dependencies.config.daemonPassword));

    app.get('/api/metrics/snapshot', async (_req, res) => {
        sendSuccess(res, await dependencies.metricsService.collectSnapshot());
    });

    app.get('/api/objects/:bucket', async (req, res) => {
        try {
            const bucket = readBucket(req.params.bucket);
            const objectKey = readString(req.query.objectKey, 'objectKey');

            const stat = await dependencies.minioService.statObject(bucket, objectKey);
            const stream = await dependencies.minioService.getObjectStream(bucket, objectKey);

            res.setHeader('content-length', String(stat.size));
            if (typeof stat.metaData['content-type'] === 'string') {
                res.setHeader('content-type', stat.metaData['content-type']);
            }

            stream.pipe(res);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.get('/api/plugins/listings', async (req, res) => {
        try {
            const page = req.query.page ? readNumber(Number(req.query.page), 'page') : 1;
            const limit = req.query.limit ? readNumber(Number(req.query.limit), 'limit') : 25;
            const result = await dependencies.mongoService.listPluginListings({
                pluginId: readOptionalString(req.query.pluginId),
                trajectoryId: readOptionalString(req.query.trajectoryId),
                analysisId: readOptionalString(req.query.analysisId),
                exposureId: readOptionalString(req.query.exposureId),
                page,
                limit
            });
            sendSuccess(res, result);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.get('/api/plugins/sub-listings', async (req, res) => {
        try {
            const page = req.query.page ? readNumber(Number(req.query.page), 'page') : 1;
            const limit = req.query.limit ? readNumber(Number(req.query.limit), 'limit') : 25;
            const timestep = req.query.timestep === undefined ? undefined : readNumber(Number(req.query.timestep), 'timestep');
            const result = await dependencies.mongoService.listPluginSubListings({
                analysisId: readOptionalString(req.query.analysisId),
                exposureId: readOptionalString(req.query.exposureId),
                subListingName: readOptionalString(req.query.subListingName),
                timestep,
                page,
                limit
            });
            sendSuccess(res, result);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.get('/api/containers', async (req, res) => {
        try {
            const all = req.query.all === undefined ? true : req.query.all === 'true';
            sendSuccess(res, await dependencies.dockerRuntimeService.listContainers(all));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/containers', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const envInput = Array.isArray(payload.env) ? payload.env : [];
            const portsInput = Array.isArray(payload.ports) ? payload.ports : [];
            const requestBody: CreateContainerRequest = {
                image: readString(payload.image, 'image'),
                name: readString(payload.name, 'name'),
                memoryInMegabytes: readNumber(payload.memoryInMegabytes, 'memoryInMegabytes'),
                cpus: readNumber(payload.cpus, 'cpus'),
                env: envInput.map((entry) => {
                    const item = readRecord(entry, 'env entry');
                    return {
                        key: readString(item.key, 'env.key'),
                        value: readString(item.value, 'env.value')
                    };
                }),
                ports: portsInput.map((entry) => {
                    const item = readRecord(entry, 'ports entry');
                    return {
                        private: readNumber(item.private, 'ports.private'),
                        public: readNumber(item.public, 'ports.public')
                    };
                }),
                binds: payload.binds ? readStringArray(payload.binds, 'binds') : undefined,
                cmd: payload.cmd ? readStringArray(payload.cmd, 'cmd') : undefined
            };

            const container = await dependencies.dockerRuntimeService.createContainer(requestBody);
            sendSuccess(res, container, 201);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.get('/api/containers/:containerId', async (req, res) => {
        try {
            sendSuccess(res, await dependencies.dockerRuntimeService.getContainer(readString(req.params.containerId, 'containerId')));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.patch('/api/containers/:containerId', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');

            const requestBody: UpdateContainerRequest = {
                action: readContainerAction(payload.action)
            };
            const container = await dependencies.dockerRuntimeService.applyContainerAction(
                readString(req.params.containerId, 'containerId'),
                requestBody.action
            );
            sendSuccess(res, container);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.delete('/api/containers/:containerId', async (req, res) => {
        try {
            await dependencies.dockerRuntimeService.deleteContainer(readString(req.params.containerId, 'containerId'));
            sendSuccess(res, { deleted: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.get('/api/containers/:containerId/files', async (req, res) => {
        try {
            const directoryPath = readOptionalString(req.query.path) || '/';
            sendSuccess(res, await dependencies.dockerRuntimeService.getContainerFiles(
                readString(req.params.containerId, 'containerId'),
                directoryPath
            ));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.get('/api/containers/:containerId/file', async (req, res) => {
        try {
            const fileContents = await dependencies.dockerRuntimeService.readContainerFile(
                readString(req.params.containerId, 'containerId'),
                readString(req.query.path, 'path')
            );
            sendSuccess(res, {
                contents: fileContents
            });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.put('/api/containers/:containerId/file', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const requestBody: WriteContainerFileRequest = {
                path: readString(payload.path, 'path'),
                content: readString(payload.content, 'content')
            };
            await dependencies.dockerRuntimeService.writeContainerFile(
                readString(req.params.containerId, 'containerId'),
                requestBody.path,
                requestBody.content
            );
            sendSuccess(res, { written: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.get('/api/containers/:containerId/processes', async (req, res) => {
        try {
            sendSuccess(res, await dependencies.dockerRuntimeService.getContainerProcesses(readString(req.params.containerId, 'containerId')));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.get('/api/containers/:containerId/stats', async (req, res) => {
        try {
            sendSuccess(res, await dependencies.dockerRuntimeService.getContainerStats(readString(req.params.containerId, 'containerId')));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.get('/api/notebooks', async (req, res) => {
        try {
            sendSuccess(res, await dependencies.mongoService.listNotebooks(readOptionalString(req.query.teamId)));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/notebooks', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const requestBody: CreateNotebookRequest = {
                teamId: readString(payload.teamId, 'teamId'),
                title: readString(payload.title, 'title'),
                notebookPath: readString(payload.notebookPath, 'notebookPath'),
                trajectories: readStringArray(payload.trajectories, 'trajectories'),
                createdBy: readString(payload.createdBy, 'createdBy'),
                content: payload.content ? readRecord(payload.content, 'content') : undefined
            };
            sendSuccess(res, await dependencies.mongoService.createNotebook(requestBody), 201);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.patch('/api/notebooks/:notebookId', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const requestBody: UpdateNotebookRequest = {
                title: readOptionalString(payload.title),
                content: payload.content ? readRecord(payload.content, 'content') : undefined,
                lastOpenedAt: readOptionalString(payload.lastOpenedAt)
            };
            sendSuccess(res, await dependencies.mongoService.updateNotebook(
                readString(req.params.notebookId, 'notebookId'),
                requestBody
            ));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.delete('/api/notebooks/:notebookId', async (req, res) => {
        try {
            await dependencies.jupyterRuntimeService.deleteSession(readString(req.params.notebookId, 'notebookId'));
            sendSuccess(res, {
                deleted: await dependencies.mongoService.deleteNotebook(readString(req.params.notebookId, 'notebookId'))
            });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/notebooks/:notebookId/sessions', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const requestBody: CreateNotebookSessionRequest = {
                requestedBy: readString(payload.requestedBy, 'requestedBy')
            };
            const notebook = await dependencies.mongoService.getNotebookById(readString(req.params.notebookId, 'notebookId'));
            if (!notebook) {
                throw new Error('Notebook not found');
            }

            sendSuccess(res, await dependencies.jupyterRuntimeService.ensureSession({
                notebook,
                requestedBy: requestBody.requestedBy
            }), 201);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.get('/api/notebooks/:notebookId/runtime', async (req, res) => {
        try {
            const notebookId = readString(req.params.notebookId, 'notebookId');
            sendSuccess(res, {
                hostPort: await dependencies.jupyterRuntimeService.getRuntimeHostPort(notebookId)
            });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.use('/api/notebooks/proxy/:notebookId', async (req, res) => {
        try {
            const notebookId = readString(req.params.notebookId, 'notebookId');
            const hostPort = await dependencies.jupyterRuntimeService.getRuntimeHostPort(notebookId);
            if (!hostPort) {
                throw new Error('Jupyter runtime is not available');
            }

            const requestUrl = new URL(req.originalUrl, 'http://daemon.local');
            const proxyPrefix = `/api/notebooks/proxy/${encodeURIComponent(notebookId)}`;
            const normalizedProxyPath = requestUrl.pathname.startsWith(proxyPrefix)
                ? requestUrl.pathname.slice(proxyPrefix.length) || '/'
                : '/';
            const search = requestUrl.search;
            const targetUrl = `http://127.0.0.1:${hostPort}${normalizedProxyPath}${search}`;
            const requestHeaders = new Headers();

            for (const [headerName, headerValue] of Object.entries(req.headers)) {
                if (!headerValue || headerName.toLowerCase() === 'host') {
                    continue;
                }

                if (Array.isArray(headerValue)) {
                    requestHeaders.set(headerName, headerValue.join(', '));
                    continue;
                }

                requestHeaders.set(headerName, headerValue);
            }

            const requestBody = readProxyRequestBody(req);
            const response = await fetch(targetUrl, {
                method: req.method,
                headers: requestHeaders,
                body: requestBody
            });

            res.status(response.status);
            copyHeaders(response.headers, res);

            if (!response.body) {
                res.end();
                return;
            }

            const reader = response.body.getReader();
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) {
                    break;
                }

                res.write(Buffer.from(chunk.value));
            }

            res.end();
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/orchestration/queue-dispatch', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const requestBody: QueueDispatchRequest = {
                queueName: readString(payload.queueName, 'queueName'),
                payload: readRecord(payload.payload, 'payload')
            };
            await dependencies.redisService.enqueue(requestBody.queueName, requestBody.payload);
            sendSuccess(res, { queued: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/orchestration/object-upload', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const requestBody: ObjectUploadRequest = {
                bucket: readBucket(payload.bucket),
                objectKey: readString(payload.objectKey, 'objectKey'),
                content: readString(payload.content, 'content'),
                encoding: readTextEncoding(payload.encoding),
                metadata: payload.metadata ? readStringRecord(payload.metadata, 'metadata') : undefined
            };
            await dependencies.orchestrationService.uploadObject(requestBody);
            sendSuccess(res, { uploaded: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/orchestration/plugins/sync', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const requestBody: PluginSyncRequest = {
                pluginId: readString(payload.pluginId, 'pluginId'),
                objectKey: readString(payload.objectKey, 'objectKey')
            };
            sendSuccess(res, await dependencies.orchestrationService.syncPluginBinary(requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/orchestration/analysis/start', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const analysisPayload = readRecord(payload.payload, 'payload');
            const requestBody: AnalysisStartRequest = {
                analysisId: readString(payload.analysisId, 'analysisId'),
                payload: {
                    teamId: readString(analysisPayload.teamId, 'payload.teamId'),
                    trajectoryId: readString(analysisPayload.trajectoryId, 'payload.trajectoryId'),
                    jobs: readAnalysisQueueJobs(analysisPayload.jobs)
                }
            };
            await dependencies.orchestrationService.startAnalysis(requestBody);
            sendSuccess(res, { queued: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/orchestration/trajectory/preprocess', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const requestBody: TrajectoryPreprocessRequest = {
                trajectoryId: readString(payload.trajectoryId, 'trajectoryId'),
                payload: readRecord(payload.payload, 'payload')
            };
            await dependencies.orchestrationService.preprocessTrajectory(requestBody);
            sendSuccess(res, { queued: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/orchestration/native/trajectory/preprocess', async (req, res) => {
        try {
            const requestBody: NativeTrajectoryPreprocessRequest = readNativeTrajectoryRequest(req.body);
            await dependencies.orchestrationService.preprocessTrajectoryNative(requestBody);
            sendSuccess(res, { processed: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/native/trajectory/metadata', async (req, res) => {
        try {
            const requestBody: NativeTrajectoryMetadataRequest = readNativeTrajectoryRequest(req.body);
            sendSuccess(res, await dependencies.orchestrationService.getTrajectoryMetadata(requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/native/trajectory/property-stats', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const baseRequest = readNativeTrajectoryRequest(payload);
            const requestBody: NativeTrajectoryPropertyStatsRequest = {
                ...baseRequest,
                property: readString(payload.property, 'property')
            };
            sendSuccess(res, await dependencies.orchestrationService.getPropertyStats(requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/native/trajectory/unique-values', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const baseRequest = readNativeTrajectoryRequest(payload);
            const requestBody: NativeTrajectoryUniqueValuesRequest = {
                ...baseRequest,
                property: readString(payload.property, 'property'),
                maxValues: payload.maxValues === undefined ? undefined : readInteger(payload.maxValues, 'maxValues')
            };
            sendSuccess(res, await dependencies.orchestrationService.getUniqueValues(requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/native/trajectory/atoms', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const baseRequest = readNativeTrajectoryRequest(payload);
            const requestBody: NativeTrajectoryAtomsPageRequest = {
                ...baseRequest,
                page: readInteger(payload.page, 'page'),
                limit: readInteger(payload.limit, 'limit')
            };
            sendSuccess(res, await dependencies.orchestrationService.getAtomsPage(requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/native/trajectory/filter-preview', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const baseRequest = readNativeTrajectoryRequest(payload);
            const requestBody: NativeTrajectoryFilterPreviewRequest = {
                ...baseRequest,
                property: readString(payload.property, 'property'),
                operator: readString(payload.operator, 'operator'),
                value: readNumber(payload.value, 'value'),
                externalValuesBase64: readOptionalString(payload.externalValuesBase64)
            };
            sendSuccess(res, await dependencies.orchestrationService.previewFilter(requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/native/trajectory/color-model', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const baseRequest = readNativeTrajectoryRequest(payload);
            const requestBody: NativeTrajectoryColorModelRequest = {
                ...baseRequest,
                property: readString(payload.property, 'property'),
                objectKey: readString(payload.objectKey, 'objectKey'),
                startValue: readNumber(payload.startValue, 'startValue'),
                endValue: readNumber(payload.endValue, 'endValue'),
                gradient: readString(payload.gradient, 'gradient'),
                externalValuesBase64: readOptionalString(payload.externalValuesBase64)
            };
            sendSuccess(res, await dependencies.orchestrationService.exportColoredModel(requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/native/trajectory/particle-filter-model', async (req, res) => {
        try {
            const payload = readRecord(req.body, 'body');
            const baseRequest = readNativeTrajectoryRequest(payload);
            const requestBody: NativeTrajectoryParticleFilterModelRequest = {
                ...baseRequest,
                objectKey: readString(payload.objectKey, 'objectKey'),
                action: readParticleFilterAction(payload.action),
                maskBase64: readString(payload.maskBase64, 'maskBase64')
            };
            sendSuccess(res, await dependencies.orchestrationService.exportParticleFilterModel(requestBody));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    app.post('/api/orchestration/uninstall', async (req, res) => {
        try {
            const payload = isRecord(req.body) ? req.body : {};
            const requestBody: UninstallRequest = {
                reason: readOptionalString(payload.reason)
            };
            await dependencies.orchestrationService.uninstall(requestBody);
            sendSuccess(res, { accepted: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    return app;
};
