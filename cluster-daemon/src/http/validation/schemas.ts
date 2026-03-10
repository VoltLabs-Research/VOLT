import {
    ContainerAction,
    ObjectBucketName,
    TextEncoding,
    type AnalysisStartRequest,
    type ClearJobsHistoryRequest,
    type CreateContainerRequest,
    type CreateNotebookRequest,
    type CreateNotebookSessionRequest,
    type NativeTrajectoryAtomsPageRequest,
    type NativeTrajectoryColorModelRequest,
    type NativeTrajectoryFilterPreviewRequest,
    type NativeTrajectoryMetadataRequest,
    type NativeTrajectoryParticleFilterModelRequest,
    type NativeTrajectoryPropertyStatsRequest,
    type NativeTrajectoryUniqueValuesRequest,
    type ObjectUploadRequest,
    type PluginSyncRequest,
    type QueueDispatchRequest,
    type RasterizeTrajectoryRequest,
    type RemoveRunningJobsRequest,
    type RetryJobsRequest,
    type TrajectoryPreprocessRequest,
    type UninstallRequest,
    type UpdateContainerRequest,
    type UpdateNotebookRequest,
    type WriteContainerFileRequest
} from '../../contracts/http';
import { z } from 'zod';

const stringRecordSchema = z.record(z.string(), z.string());
const unknownRecordSchema = z.record(z.string(), z.unknown());

const queueJobSchema = z.object({
    jobId: z.string().min(1),
    teamId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    status: z.string().min(1),
    queueType: z.string().min(1),
    maxRetries: z.number().finite().optional(),
    metadata: unknownRecordSchema.optional(),
    completedAt: z.string().min(1).optional(),
    error: z.string().min(1).optional(),
    startTime: z.string().min(1).optional(),
    progress: z.number().finite().optional(),
    message: z.string().min(1).optional(),
    workerId: z.number().finite().optional(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1)
});

const exposureSchema = z.object({
    nodeId: z.string().min(1),
    name: z.string().min(1),
    results: z.string().min(1),
    iterable: z.string().min(1).optional()
});

const executionDataSchema = z.object({
    binaryObjectPath: z.string().min(1),
    binaryFileName: z.string().min(1).optional(),
    arguments: z.string().min(1),
    pluginId: z.string().min(1),
    trajectoryId: z.string().min(1),
    analysisId: z.string().min(1),
    exposures: z.array(exposureSchema),
    forEachNodeId: z.string().min(1),
    nodeOutputSnapshots: z.record(z.string(), unknownRecordSchema)
});

const nativeTrajectoryBaseSchema = z.object({
    trajectoryId: z.string().min(1),
    timestep: z.number().int(),
    objectKey: z.string().min(1).optional()
});

export const bucketParamSchema = z.object({
    bucket: z.nativeEnum(ObjectBucketName)
});

export const objectListQuerySchema = z.object({
    prefix: z.string().optional()
});

export const objectGetQuerySchema = z.object({
    objectKey: z.string().min(1)
});

export const pluginListingsQuerySchema = z.object({
    pluginId: z.string().optional(),
    trajectoryId: z.string().optional(),
    analysisId: z.string().optional(),
    exposureId: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(25)
});

export const pluginSubListingsQuerySchema = z.object({
    analysisId: z.string().optional(),
    exposureId: z.string().optional(),
    subListingName: z.string().optional(),
    timestep: z.coerce.number().int().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(25)
});

export const jobsQuerySchema = z.object({
    teamId: z.string().min(1)
});

export const retryJobsSchema = z.object({
    jobIds: z.array(z.string().min(1))
}) satisfies z.ZodType<RetryJobsRequest>;

export const removeRunningJobsSchema = z.object({
    jobIds: z.array(z.string().min(1))
}) satisfies z.ZodType<RemoveRunningJobsRequest>;

export const clearJobsHistorySchema = z.object({
    teamId: z.string().min(1),
    jobIds: z.array(z.string().min(1)).default([])
}) satisfies z.ZodType<ClearJobsHistoryRequest>;

export const createContainerSchema = z.object({
    image: z.string().min(1),
    name: z.string().min(1),
    memoryInMegabytes: z.number().finite(),
    cpus: z.number().finite(),
    env: z.array(z.object({
        key: z.string().min(1),
        value: z.string()
    })).optional(),
    ports: z.array(z.object({
        private: z.number().finite(),
        public: z.number().finite()
    })).optional(),
    binds: z.array(z.string().min(1)).optional(),
    labels: stringRecordSchema.optional(),
    cmd: z.array(z.string()).optional()
}) satisfies z.ZodType<CreateContainerRequest>;

export const containerIdParamSchema = z.object({
    containerId: z.string().min(1)
});

export const updateContainerSchema = z.object({
    action: z.nativeEnum(ContainerAction)
}) satisfies z.ZodType<UpdateContainerRequest>;

export const containerPathQuerySchema = z.object({
    path: z.string().optional()
});

export const writeContainerFileSchema = z.object({
    path: z.string().min(1),
    content: z.string()
}) satisfies z.ZodType<WriteContainerFileRequest>;

export const notebooksQuerySchema = z.object({
    teamId: z.string().optional()
});

export const createNotebookSchema = z.object({
    _id: z.string().min(1).optional(),
    teamId: z.string().min(1),
    title: z.string().min(1),
    notebookPath: z.string().min(1),
    trajectories: z.array(z.string().min(1)),
    createdBy: z.string().min(1),
    content: unknownRecordSchema.optional()
}) satisfies z.ZodType<CreateNotebookRequest>;

export const notebookIdParamSchema = z.object({
    notebookId: z.string().min(1)
});

export const updateNotebookSchema = z.object({
    title: z.string().min(1).optional(),
    content: unknownRecordSchema.optional(),
    lastOpenedAt: z.string().min(1).optional()
}) satisfies z.ZodType<UpdateNotebookRequest>;

export const createNotebookSessionSchema = z.object({
    requestedBy: z.string().min(1)
}) satisfies z.ZodType<CreateNotebookSessionRequest>;

export const queueDispatchSchema = z.object({
    queueName: z.string().min(1),
    payload: unknownRecordSchema
}) satisfies z.ZodType<QueueDispatchRequest>;

export const objectUploadSchema = z.object({
    bucket: z.nativeEnum(ObjectBucketName),
    objectKey: z.string().min(1),
    content: z.string(),
    encoding: z.nativeEnum(TextEncoding).optional(),
    metadata: stringRecordSchema.optional()
}) satisfies z.ZodType<ObjectUploadRequest>;

export const pluginSyncSchema = z.object({
    pluginId: z.string().min(1),
    objectKey: z.string().min(1)
}) satisfies z.ZodType<PluginSyncRequest>;

export const analysisStartSchema = z.object({
    analysisId: z.string().min(1),
    executionData: executionDataSchema,
    payload: z.object({
        teamId: z.string().min(1),
        trajectoryId: z.string().min(1),
        jobs: z.array(queueJobSchema)
    })
}) satisfies z.ZodType<AnalysisStartRequest>;

export const trajectoryPreprocessSchema = z.object({
    trajectoryId: z.string().min(1),
    payload: unknownRecordSchema
}) satisfies z.ZodType<TrajectoryPreprocessRequest>;

export const rasterizeTrajectorySchema = z.object({
    trajectoryId: z.string().min(1)
}) satisfies z.ZodType<RasterizeTrajectoryRequest>;

export const nativeTrajectoryMetadataSchema = nativeTrajectoryBaseSchema satisfies z.ZodType<NativeTrajectoryMetadataRequest>;

export const nativeTrajectoryPropertyStatsSchema = nativeTrajectoryBaseSchema.extend({
    property: z.string().min(1)
}) satisfies z.ZodType<NativeTrajectoryPropertyStatsRequest>;

export const nativeTrajectoryUniqueValuesSchema = nativeTrajectoryBaseSchema.extend({
    property: z.string().min(1),
    maxValues: z.number().int().optional()
}) satisfies z.ZodType<NativeTrajectoryUniqueValuesRequest>;

export const nativeTrajectoryAtomsPageSchema = nativeTrajectoryBaseSchema.extend({
    page: z.number().int(),
    limit: z.number().int()
}) satisfies z.ZodType<NativeTrajectoryAtomsPageRequest>;

export const nativeTrajectoryFilterPreviewSchema = nativeTrajectoryBaseSchema.extend({
    property: z.string().min(1),
    operator: z.string().min(1),
    value: z.number().finite(),
    externalValuesBase64: z.string().min(1).optional()
}) satisfies z.ZodType<NativeTrajectoryFilterPreviewRequest>;

export const nativeTrajectoryColorModelSchema = nativeTrajectoryBaseSchema.extend({
    property: z.string().min(1),
    objectKey: z.string().min(1),
    startValue: z.number().finite(),
    endValue: z.number().finite(),
    gradient: z.string().min(1),
    externalValuesBase64: z.string().min(1).optional()
}) satisfies z.ZodType<NativeTrajectoryColorModelRequest>;

export const nativeTrajectoryParticleFilterModelSchema = nativeTrajectoryBaseSchema.extend({
    objectKey: z.string().min(1),
    action: z.enum(['delete', 'highlight']),
    maskBase64: z.string().min(1)
}) satisfies z.ZodType<NativeTrajectoryParticleFilterModelRequest>;

export const uninstallSchema = z.object({
    reason: z.string().min(1).optional()
}) satisfies z.ZodType<UninstallRequest>;
