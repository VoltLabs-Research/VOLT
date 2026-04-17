import { z } from 'zod';

type DaemonRuntimeRole = 'cluster' | 'storage-server' | 'compute-node';
type DaemonObjectBucketName = 'volt-dumps' | 'volt-models' | 'volt-plugins' | 'volt-rasterizer';

interface MinioConfig {
    endpoint: string;
    accessKey: string;
    secretKey: string;
    useSSL: boolean;
}

interface RedisConfig {
    host: string;
    port: number;
    username?: string;
    password?: string;
}

interface JupyterHostPortRange {
    start: number;
    end: number;
}

interface JupyterConfig {
    image: string;
    memoryInMegabytes: number;
    cpus: number;
    execTimeoutMs: number;
    notebookRoot: string;
    port: number;
    token: string;
    uiPath: string;
    frameAncestors: string;
    startTimeoutMs: number;
    hostPortRange?: JupyterHostPortRange;
    publicBasePath: string;
}

interface DaemonRuntimeRoleDrainState {
    compute: boolean;
    storage: boolean;
}

interface DaemonQueueScopeLimit {
    maxRunningPerTrajectory: number;
    maxRunningPerTeam: number;
}

interface DaemonQueueScopeLimits {
    analysisProcessing: DaemonQueueScopeLimit;
    artifactUpload: DaemonQueueScopeLimit;
    cloudUpload: DaemonQueueScopeLimit;
    trajectoryCompression: DaemonQueueScopeLimit;
    trajectoryGlbConversion: DaemonQueueScopeLimit;
}

interface DaemonQueueConcurrency {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    sshImport: number;
}

interface DaemonRuntimeRoleConfig {
    desiredRole: DaemonRuntimeRole;
    effectiveRole: DaemonRuntimeRole;
    runtimeVersion: number;
    draining: DaemonRuntimeRoleDrainState;
    lastAppliedAt?: string | Date | null;
}

interface DaemonEffectiveCapabilities {
    acceptsComputeJobs: boolean;
    acceptsStorageWrites: boolean;
    servesStorageReads: boolean;
    servesArtifactDownloads: boolean;
}

export interface DaemonRuntimeConfig {
    contractVersion: number;
    queueConcurrency: DaemonQueueConcurrency;
    queueScopeLimits: DaemonQueueScopeLimits;
    roleConfig: DaemonRuntimeRoleConfig;
    effectiveCapabilities: DaemonEffectiveCapabilities;
}

export interface DaemonConfig {
    port: number;
    host: string;
    teamId?: string;
    objectGatewayEnabled: boolean;
    teamClusterId: string;
    daemonPassword: string;
    enrollmentToken?: string;
    installedVersion: string;
    voltCloudUrl: string;
    healthcheckPath?: string;
    controlSocketUrl?: string;
    heartbeatIntervalMs: number;
    metricsIntervalMs: number;
    composeProjectName?: string;
    installRoot?: string;
    minio: MinioConfig;
    mongodbUri: string;
    redis: RedisConfig;
    jupyter: JupyterConfig;
    allowedBuckets: DaemonObjectBucketName[];
}

const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;
const DEFAULT_METRICS_INTERVAL_MS = 3_000;
const DEFAULT_JUPYTER_IMAGE = 'ghcr.io/voltlabs-research/volt-jupyter-scripting:main';

const requiredStringEnv = z.string().min(1);
const optionalStringEnv = z.string().min(1).optional().catch(undefined);

const optionalNumberEnv = z.string().min(1).transform(Number).pipe(z.number().finite()).optional().catch(undefined);

const booleanText = ['true', '1', 'yes'];

const portSchema = z.number().int().min(1).max(65535);

const envSchema = z.object({
    VOLT_CLOUD_URL: requiredStringEnv.transform((value) => value.replace(/\/+$/g, '')),
    PORT: z.string().min(1).transform(Number).pipe(z.number().finite()).catch(8080),
    HOST: z.string().min(1).catch('0.0.0.0'),
    TEAM_ID: optionalStringEnv,
    VOLT_TEAM_ID: optionalStringEnv,
    TEAM_CLUSTER_OBJECT_GATEWAY_ENABLED: z.string().min(1).transform((value) => booleanText.includes(value.toLowerCase())).catch(true),
    TEAM_CLUSTER_ID: requiredStringEnv,
    TEAM_CLUSTER_DAEMON_PASSWORD: requiredStringEnv,
    TEAM_CLUSTER_ENROLLMENT_TOKEN: optionalStringEnv,
    VOLT_CLUSTER_INSTALL_MANIFEST_VERSION: z.string().min(1).catch('1.0.0'),
    TEAM_CLUSTER_HEALTHCHECK_PATH: optionalStringEnv,
    VOLT_CLOUD_DAEMON_SOCKET_URL: optionalStringEnv,
    TEAM_CLUSTER_HEARTBEAT_INTERVAL_MS: z.string().min(1).transform(Number).pipe(z.number().finite()).catch(DEFAULT_HEARTBEAT_INTERVAL_MS),
    TEAM_CLUSTER_METRICS_INTERVAL_MS: z.string().min(1).transform(Number).pipe(z.number().finite()).catch(DEFAULT_METRICS_INTERVAL_MS),
    COMPOSE_PROJECT_NAME: optionalStringEnv,
    TEAM_CLUSTER_INSTALL_ROOT: optionalStringEnv,
    MINIO_ENDPOINT: requiredStringEnv,
    MINIO_ACCESS_KEY: requiredStringEnv,
    MINIO_SECRET_KEY: requiredStringEnv,
    MINIO_USE_SSL: z.string().min(1).transform((value) => booleanText.includes(value.toLowerCase())).catch(false),
    MONGODB_URI: requiredStringEnv,
    REDIS_HOST: requiredStringEnv,
    REDIS_PORT: z.string().min(1).transform(Number).pipe(z.number().finite()).catch(6379),
    REDIS_USERNAME: optionalStringEnv,
    REDIS_PASSWORD: optionalStringEnv,
    JUPYTER_IMAGE: z.string().min(1).catch(DEFAULT_JUPYTER_IMAGE),
    JUPYTER_CONTAINER_MEMORY_MB: z.string().min(1).transform(Number).pipe(z.number().finite()).catch(2048),
    JUPYTER_CONTAINER_CPUS: z.string().min(1).transform(Number).pipe(z.number().finite()).catch(2),
    JUPYTER_EXEC_TIMEOUT_MS: z.string().min(1).transform(Number).pipe(z.number().finite()).catch(45_000),
    JUPYTER_NOTEBOOK_ROOT: z.string().min(1).catch('/home/jovyan/work/volt-notebooks').transform((value) => {
        if (value === '/') {
            return '/';
        }

        return `/${value.replace(/^\/+|\/+$/g, '')}`;
    }),
    JUPYTER_PORT: z.string().min(1).transform(Number).pipe(z.number().finite()).catch(8888),
    JUPYTER_TOKEN: z.string().min(1).catch('volt-scripting'),
    JUPYTER_UI_PATH: z.string().min(1).catch('/lab').transform((value) => {
        if (value === '/') {
            return '/';
        }

        return `/${value.replace(/^\/+|\/+$/g, '')}`;
    }),
    JUPYTER_FRAME_ANCESTORS: z.string().min(1).catch('*'),
    JUPYTER_START_TIMEOUT_MS: z.string().min(1).transform(Number).pipe(z.number().finite()).catch(60_000),
    JUPYTER_HOST_PORT_RANGE_START: optionalNumberEnv,
    JUPYTER_HOST_PORT_RANGE_END: optionalNumberEnv,
    JUPYTER_PUBLIC_BASE_PATH: z.string().min(1).catch('/api/notebooks/proxy').transform((value) => {
        if (value === '/') {
            return '/';
        }

        return `/${value.replace(/^\/+|\/+$/g, '')}`;
    })
});

const resolveJupyterHostPortRange = (
    start?: number,
    end?: number
): JupyterHostPortRange | undefined => {
    if (start === undefined && end === undefined) {
        return undefined;
    }

    if (start === undefined || end === undefined) {
        throw new Error('JUPYTER_HOST_PORT_RANGE_START and JUPYTER_HOST_PORT_RANGE_END must be set together');
    }

    const hostPortRange = {
        start: portSchema.parse(start),
        end: portSchema.parse(end)
    };

    if (hostPortRange.start > hostPortRange.end) {
        throw new Error('JUPYTER_HOST_PORT_RANGE_START must be less than or equal to JUPYTER_HOST_PORT_RANGE_END');
    }

    return hostPortRange;
};

export const loadConfig = (): DaemonConfig => {
    const env = envSchema.parse(process.env);
    const minio: MinioConfig = {
        endpoint: env.MINIO_ENDPOINT,
        accessKey: env.MINIO_ACCESS_KEY,
        secretKey: env.MINIO_SECRET_KEY,
        useSSL: env.MINIO_USE_SSL
    };
    const redis: RedisConfig = {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        username: env.REDIS_USERNAME,
        password: env.REDIS_PASSWORD
    };
    const jupyter: JupyterConfig = {
        image: env.JUPYTER_IMAGE,
        memoryInMegabytes: env.JUPYTER_CONTAINER_MEMORY_MB,
        cpus: env.JUPYTER_CONTAINER_CPUS,
        execTimeoutMs: env.JUPYTER_EXEC_TIMEOUT_MS,
        notebookRoot: env.JUPYTER_NOTEBOOK_ROOT,
        port: env.JUPYTER_PORT,
        token: env.JUPYTER_TOKEN,
        uiPath: env.JUPYTER_UI_PATH,
        frameAncestors: env.JUPYTER_FRAME_ANCESTORS,
        startTimeoutMs: env.JUPYTER_START_TIMEOUT_MS,
        hostPortRange: resolveJupyterHostPortRange(
            env.JUPYTER_HOST_PORT_RANGE_START,
            env.JUPYTER_HOST_PORT_RANGE_END
        ),
        publicBasePath: env.JUPYTER_PUBLIC_BASE_PATH
    };
    const allowedBuckets: DaemonObjectBucketName[] = [
        'volt-dumps',
        'volt-models',
        'volt-plugins',
        'volt-rasterizer'
    ];

    const config: DaemonConfig = {
        port: env.PORT,
        host: env.HOST,
        teamId: env.TEAM_ID ?? env.VOLT_TEAM_ID,
        objectGatewayEnabled: env.TEAM_CLUSTER_OBJECT_GATEWAY_ENABLED,
        teamClusterId: env.TEAM_CLUSTER_ID,
        daemonPassword: env.TEAM_CLUSTER_DAEMON_PASSWORD,
        enrollmentToken: env.TEAM_CLUSTER_ENROLLMENT_TOKEN,
        installedVersion: env.VOLT_CLUSTER_INSTALL_MANIFEST_VERSION,
        voltCloudUrl: env.VOLT_CLOUD_URL,
        healthcheckPath: env.TEAM_CLUSTER_HEALTHCHECK_PATH,
        controlSocketUrl: env.VOLT_CLOUD_DAEMON_SOCKET_URL,
        heartbeatIntervalMs: env.TEAM_CLUSTER_HEARTBEAT_INTERVAL_MS,
        metricsIntervalMs: env.TEAM_CLUSTER_METRICS_INTERVAL_MS,
        composeProjectName: env.COMPOSE_PROJECT_NAME,
        installRoot: env.TEAM_CLUSTER_INSTALL_ROOT,
        minio,
        mongodbUri: env.MONGODB_URI,
        redis,
        jupyter,
        allowedBuckets
    };

    return config;
};
