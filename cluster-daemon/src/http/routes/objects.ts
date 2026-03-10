import {
    analysisStartSchema,
    bucketParamSchema,
    clearJobsHistorySchema,
    jobsQuerySchema,
    objectGetQuerySchema,
    objectListQuerySchema,
    objectUploadSchema,
    pluginListingsQuerySchema,
    pluginSubListingsQuerySchema,
    pluginSyncSchema,
    queueDispatchSchema,
    rasterizeTrajectorySchema,
    removeRunningJobsSchema,
    retryJobsSchema,
    trajectoryPreprocessSchema,
    uninstallSchema
} from '../validation/schemas';
import {
    clearJobsHistory,
    preprocessTrajectory,
    rasterizeTrajectory,
    removeRunningJobs,
    retryJobs,
    startAnalysis,
    syncPluginBinary,
    uploadObject
} from '../../core/runtimeActions';
import { parseValue, sendError, sendSuccess } from '../common';
import express from 'express';
import fs from 'node:fs/promises';
import type { DaemonConfig } from '../../core/config';
import type { DockerRuntimeService } from '../../infrastructure/docker/DockerRuntimeService';
import type { RuntimeEventBroker } from '../../infrastructure/RuntimeEventBroker';
import type { MinioService } from '../../infrastructure/minio/MinioService';
import type { NotebookRepository } from '../../infrastructure/mongo/repositories/NotebookRepository';
import type { PluginListingRepository } from '../../infrastructure/mongo/repositories/PluginListingRepository';
import type { QueueService } from '../../infrastructure/redis/QueueService';
import type { RedisConnectionService } from '../../infrastructure/redis/RedisConnectionService';
import type { RasterizerService } from '../../modules/native/RasterizerService';

interface ObjectsRouterDependencies {
    config: DaemonConfig;
    eventBroker: RuntimeEventBroker;
    minioService: MinioService;
    pluginListingRepository: PluginListingRepository;
    notebookRepository: NotebookRepository;
    queueService: QueueService;
    redisConnectionService: RedisConnectionService;
    rasterizerService: RasterizerService;
    dockerRuntimeService: DockerRuntimeService;
};

export const createObjectsRouter = (dependencies: ObjectsRouterDependencies) => {
    const router = express.Router();

    router.get('/api/objects/:bucket/list', async (req, res) => {
        try {
            const params = parseValue(bucketParamSchema, req.params);
            const query = parseValue(objectListQuerySchema, req.query);
            const keys = await dependencies.minioService.listObjects(params.bucket, query.prefix || '');
            sendSuccess(res, { keys });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.get('/api/objects/:bucket', async (req, res) => {
        try {
            const params = parseValue(bucketParamSchema, req.params);
            const query = parseValue(objectGetQuerySchema, req.query);
            const stat = await dependencies.minioService.statObject(params.bucket, query.objectKey);
            const stream = await dependencies.minioService.getObjectStream(params.bucket, query.objectKey);

            res.setHeader('content-length', String(stat.size));
            if (typeof stat.metaData['content-type'] === 'string') {
                res.setHeader('content-type', stat.metaData['content-type']);
            }

            stream.pipe(res);
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.get('/api/plugins/listings', async (req, res) => {
        try {
            const query = parseValue(pluginListingsQuerySchema, req.query);
            sendSuccess(res, await dependencies.pluginListingRepository.listPluginListings(query));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.get('/api/plugins/sub-listings', async (req, res) => {
        try {
            const query = parseValue(pluginSubListingsQuerySchema, req.query);
            sendSuccess(res, await dependencies.pluginListingRepository.listPluginSubListings(query));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.get('/api/jobs', async (req, res) => {
        try {
            const query = parseValue(jobsQuerySchema, req.query);
            const jobs = await dependencies.redisConnectionService.getTeamJobs(query.teamId);
            sendSuccess(res, {
                data: jobs.map((job) => ({
                    createdAt: typeof job.createdAt === 'string' ? job.createdAt : new Date().toISOString(),
                    updatedAt: typeof job.updatedAt === 'string' ? job.updatedAt : new Date().toISOString(),
                    ...job
                }))
            });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/jobs/retry', async (req, res) => {
        try {
            const requestBody = parseValue(retryJobsSchema, req.body);
            sendSuccess(res, await retryJobs(requestBody, dependencies.queueService, dependencies.redisConnectionService));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/jobs/remove-running', async (req, res) => {
        try {
            const requestBody = parseValue(removeRunningJobsSchema, req.body);
            sendSuccess(res, await removeRunningJobs(requestBody, dependencies.queueService, dependencies.redisConnectionService));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.delete('/api/jobs/history', async (req, res) => {
        try {
            const requestBody = parseValue(clearJobsHistorySchema, req.body);
            sendSuccess(res, await clearJobsHistory(requestBody, dependencies.redisConnectionService));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/orchestration/queue-dispatch', async (req, res) => {
        try {
            const requestBody = parseValue(queueDispatchSchema, req.body);
            await dependencies.queueService.enqueue(requestBody.queueName, requestBody.payload);
            sendSuccess(res, { queued: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/orchestration/object-upload', async (req, res) => {
        try {
            const requestBody = parseValue(objectUploadSchema, req.body);
            await uploadObject(requestBody, dependencies.minioService, dependencies.eventBroker);
            sendSuccess(res, { uploaded: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/orchestration/plugins/sync', async (req, res) => {
        try {
            const requestBody = parseValue(pluginSyncSchema, req.body);
            sendSuccess(res, await syncPluginBinary(requestBody, dependencies.minioService, dependencies.eventBroker));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/orchestration/analysis/start', async (req, res) => {
        try {
            const requestBody = parseValue(analysisStartSchema, req.body);
            await startAnalysis(requestBody, dependencies.queueService, dependencies.redisConnectionService, dependencies.eventBroker);
            sendSuccess(res, { queued: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/orchestration/trajectory/preprocess', async (req, res) => {
        try {
            const requestBody = parseValue(trajectoryPreprocessSchema, req.body);
            await preprocessTrajectory(requestBody, dependencies.queueService, dependencies.eventBroker);
            sendSuccess(res, { queued: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/orchestration/rasterize', async (req, res) => {
        try {
            const requestBody = parseValue(rasterizeTrajectorySchema, req.body);
            sendSuccess(res, await rasterizeTrajectory(requestBody, dependencies.minioService, dependencies.rasterizerService));
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    router.post('/api/orchestration/uninstall', async (req, res) => {
        try {
            parseValue(uninstallSchema, req.body);

            setTimeout(async () => {
                try {
                    if (dependencies.config.composeProjectName) {
                        await dependencies.dockerRuntimeService.removeComposeProject(dependencies.config.composeProjectName);
                    }

                    if (dependencies.config.installRoot) {
                        const installDirectory = `${dependencies.config.installRoot}/${dependencies.config.teamClusterId}`;
                        await fs.rm(installDirectory, {
                            recursive: true,
                            force: true
                        });
                    }

                    process.exit(0);
                } catch {
                }
            }, 250);

            sendSuccess(res, { accepted: true });
        } catch (error: unknown) {
            sendError(res, error);
        }
    });

    return router;
};
