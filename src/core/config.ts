import { ObjectBucketName } from '@/core/storage/contracts/http-object-store';
import type { RedisConnectionOptions } from '@/core/storage/contracts/redis-connection';

interface MinioConfig {
    endpoint: string;
    accessKey: string;
    secretKey: string;
    useSSL: boolean;
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

export interface DaemonConfig {
    port: number;
    host: string;
    teamId?: string;
    teamClusterId: string;
    daemonPassword: string;
    voltCloudUrl: string;
    heartbeatIntervalMs: number;
    metricsIntervalMs: number;
    composeProjectName?: string;
    installRoot?: string;
    minio: MinioConfig;
    mongodbUri: string;
    redis: RedisConnectionOptions;
    jupyter: JupyterConfig;
    allowedBuckets: ObjectBucketName[];
    bucketPrefix: string;
}

const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;
const DEFAULT_METRICS_INTERVAL_MS = 3_000;
const DEFAULT_JUPYTER_IMAGE = 'ghcr.io/voltlabs-research/volt-jupyter-scripting:main';

const BOOLEAN_TRUTHY = new Set(['true', '1', 'yes']);

const readRequiredString = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
};

const readOptionalString = (name: string): string | undefined => {
    const value = process.env[name];
    return value ? value : undefined;
};

const readStringWithDefault = (name: string, fallback: string): string => {
    const value = process.env[name];
    return value ? value : fallback;
};

const readNumberWithDefault = (name: string, fallback: number): number => {
    const value = process.env[name];
    if (!value) {
        return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const readOptionalNumber = (name: string): number | undefined => {
    const value = process.env[name];
    if (!value) {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const readBooleanWithDefault = (name: string, fallback: boolean): boolean => {
    const value = process.env[name];
    return value ? BOOLEAN_TRUTHY.has(value.toLowerCase()) : fallback;
};

const normalizePath = (value: string): string => {
    if (value === '/') {
        return '/';
    }
    return `/${value.replace(/^\/+|\/+$/g, '')}`;
};

const resolveJupyterHostPortRange = (
    start: number | undefined,
    end: number | undefined
): JupyterHostPortRange | undefined => {
    if (start === undefined && end === undefined) {
        return undefined;
    }

    if (start === undefined || end === undefined) {
        throw new Error('JUPYTER_HOST_PORT_RANGE_START and JUPYTER_HOST_PORT_RANGE_END must be set together');
    }

    if (start > end) {
        throw new Error('JUPYTER_HOST_PORT_RANGE_START must be less than or equal to JUPYTER_HOST_PORT_RANGE_END');
    }

    return { start, end };
};

export const loadConfig = (): DaemonConfig => {
    const minio: MinioConfig = {
        endpoint: readRequiredString('MINIO_ENDPOINT'),
        accessKey: readRequiredString('MINIO_ACCESS_KEY'),
        secretKey: readRequiredString('MINIO_SECRET_KEY'),
        useSSL: readBooleanWithDefault('MINIO_USE_SSL', false)
    };
    const redisKeyPrefix = readStringWithDefault('REDIS_KEY_PREFIX', '');
    const redis: RedisConnectionOptions = {
        host: readRequiredString('REDIS_HOST'),
        port: readNumberWithDefault('REDIS_PORT', 6379),
        username: readOptionalString('REDIS_USERNAME'),
        password: readOptionalString('REDIS_PASSWORD'),
        keyPrefix: redisKeyPrefix || undefined
    };
    const jupyter: JupyterConfig = {
        image: readStringWithDefault('JUPYTER_IMAGE', DEFAULT_JUPYTER_IMAGE),
        memoryInMegabytes: readNumberWithDefault('JUPYTER_CONTAINER_MEMORY_MB', 2048),
        cpus: readNumberWithDefault('JUPYTER_CONTAINER_CPUS', 2),
        execTimeoutMs: readNumberWithDefault('JUPYTER_EXEC_TIMEOUT_MS', 45_000),
        notebookRoot: normalizePath(readStringWithDefault('JUPYTER_NOTEBOOK_ROOT', '/home/jovyan/work/volt-notebooks')),
        port: readNumberWithDefault('JUPYTER_PORT', 8888),
        token: readStringWithDefault('JUPYTER_TOKEN', 'volt-scripting'),
        uiPath: normalizePath(readStringWithDefault('JUPYTER_UI_PATH', '/lab')),
        frameAncestors: readStringWithDefault('JUPYTER_FRAME_ANCESTORS', '*'),
        startTimeoutMs: readNumberWithDefault('JUPYTER_START_TIMEOUT_MS', 60_000),
        hostPortRange: resolveJupyterHostPortRange(
            readOptionalNumber('JUPYTER_HOST_PORT_RANGE_START'),
            readOptionalNumber('JUPYTER_HOST_PORT_RANGE_END')
        ),
        publicBasePath: normalizePath(readStringWithDefault('JUPYTER_PUBLIC_BASE_PATH', '/api/notebooks/proxy'))
    };
    const allowedBuckets: ObjectBucketName[] = [
        ObjectBucketName.Dumps,
        ObjectBucketName.Models,
        ObjectBucketName.Plugins,
        ObjectBucketName.Rasterizer,
        ObjectBucketName.Vtr,
        ObjectBucketName.VtrDict,
        ObjectBucketName.VtrBlobs
    ];

    const config: DaemonConfig = {
        port: readNumberWithDefault('PORT', 8080),
        host: readStringWithDefault('HOST', '0.0.0.0'),
        teamId: readOptionalString('TEAM_ID') ?? readOptionalString('VOLT_TEAM_ID'),
        teamClusterId: readRequiredString('TEAM_CLUSTER_ID'),
        daemonPassword: readRequiredString('TEAM_CLUSTER_DAEMON_PASSWORD'),
        voltCloudUrl: readRequiredString('VOLT_CLOUD_URL').replace(/\/+$/g, ''),
        heartbeatIntervalMs: readNumberWithDefault('TEAM_CLUSTER_HEARTBEAT_INTERVAL_MS', DEFAULT_HEARTBEAT_INTERVAL_MS),
        metricsIntervalMs: readNumberWithDefault('TEAM_CLUSTER_METRICS_INTERVAL_MS', DEFAULT_METRICS_INTERVAL_MS),
        composeProjectName: readOptionalString('COMPOSE_PROJECT_NAME'),
        installRoot: readOptionalString('TEAM_CLUSTER_INSTALL_ROOT'),
        minio,
        mongodbUri: readRequiredString('MONGODB_URI'),
        redis,
        jupyter,
        allowedBuckets,
        bucketPrefix: readStringWithDefault('BUCKET_PREFIX', '')
    };

    return config;
};
