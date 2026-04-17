import { ObjectBucketName } from '@/contracts';
import type { TeamClusterDaemonRuntimeConfig } from '@/contracts';
import { z } from 'zod';

interface MinioConfig {
    endpoint: string;
    accessKey: string;
    secretKey: string;
    useSSL: boolean;
};

interface RedisConfig {
    host: string;
    port: number;
    username?: string;
    password?: string;
};

interface JupyterHostPortRange {
    start: number;
    end: number;
};

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
};

export type DaemonRuntimeConfig = TeamClusterDaemonRuntimeConfig;

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
    allowedBuckets: ObjectBucketName[];
};

const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;
const DEFAULT_METRICS_INTERVAL_MS = 3_000;
const DEFAULT_JUPYTER_IMAGE = 'ghcr.io/voltlabs-research/volt-jupyter-scripting:main';

const trimText = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue || undefined;
};

const normalizePath = (value: string): string => {
    const normalizedValue = value.trim();
    if (!normalizedValue || normalizedValue === '/') {
        return '/';
    }

    return `/${normalizedValue.replace(/^\/+|\/+$/g, '')}`;
};

const normalizeCloudUrl = (value: string): string => {
    return value.replace(/\/+$/g, '');
};

const requiredStringEnv = z.preprocess((value) => trimText(value), z.string().min(1));
const optionalStringEnv = z.preprocess((value) => trimText(value), z.string().min(1).optional());

const stringEnv = (fallback: string, normalize: (value: string) => string = (value) => value) => {
    return z.preprocess((value) => trimText(value) ?? fallback, z.string().transform(normalize));
};

const numberEnv = (fallback: number) => {
    return z.preprocess((value) => {
        const text = trimText(value);
        return text ? Number(text) : fallback;
    }, z.number().finite());
};

const optionalNumberEnv = z.preprocess((value) => {
    const text = trimText(value);
    return text ? Number(text) : undefined;
}, z.number().finite().optional());

const booleanEnv = (fallback: boolean) => {
    return z.preprocess((value) => {
        const text = trimText(value);
        return text
            ? ['true', '1', 'yes'].includes(text.toLowerCase())
            : fallback;
    }, z.boolean());
};

const portSchema = z.number().int().min(1).max(65535);

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

const envSchema = z.object({
    VOLT_CLOUD_URL: requiredStringEnv.transform(normalizeCloudUrl),
    PORT: numberEnv(8080),
    HOST: stringEnv('0.0.0.0'),
    TEAM_ID: optionalStringEnv,
    VOLT_TEAM_ID: optionalStringEnv,
    TEAM_CLUSTER_OBJECT_GATEWAY_ENABLED: booleanEnv(true),
    TEAM_CLUSTER_ID: requiredStringEnv,
    TEAM_CLUSTER_DAEMON_PASSWORD: requiredStringEnv,
    TEAM_CLUSTER_ENROLLMENT_TOKEN: optionalStringEnv,
    VOLT_CLUSTER_INSTALL_MANIFEST_VERSION: stringEnv('1.0.0'),
    TEAM_CLUSTER_HEALTHCHECK_PATH: optionalStringEnv,
    VOLT_CLOUD_DAEMON_SOCKET_URL: optionalStringEnv,
    TEAM_CLUSTER_HEARTBEAT_INTERVAL_MS: numberEnv(DEFAULT_HEARTBEAT_INTERVAL_MS),
    TEAM_CLUSTER_METRICS_INTERVAL_MS: numberEnv(DEFAULT_METRICS_INTERVAL_MS),
    COMPOSE_PROJECT_NAME: optionalStringEnv,
    TEAM_CLUSTER_INSTALL_ROOT: optionalStringEnv,
    MINIO_ENDPOINT: requiredStringEnv,
    MINIO_ACCESS_KEY: requiredStringEnv,
    MINIO_SECRET_KEY: requiredStringEnv,
    MINIO_USE_SSL: booleanEnv(false),
    MONGODB_URI: requiredStringEnv,
    REDIS_HOST: requiredStringEnv,
    REDIS_PORT: numberEnv(6379),
    REDIS_USERNAME: optionalStringEnv,
    REDIS_PASSWORD: optionalStringEnv,
    JUPYTER_IMAGE: stringEnv(DEFAULT_JUPYTER_IMAGE),
    JUPYTER_CONTAINER_MEMORY_MB: numberEnv(2048),
    JUPYTER_CONTAINER_CPUS: numberEnv(2),
    JUPYTER_EXEC_TIMEOUT_MS: numberEnv(45_000),
    JUPYTER_NOTEBOOK_ROOT: stringEnv('/home/jovyan/work/volt-notebooks', normalizePath),
    JUPYTER_PORT: numberEnv(8888),
    JUPYTER_TOKEN: stringEnv('volt-scripting'),
    JUPYTER_UI_PATH: stringEnv('/lab', normalizePath),
    JUPYTER_FRAME_ANCESTORS: stringEnv('*'),
    JUPYTER_START_TIMEOUT_MS: numberEnv(60_000),
    JUPYTER_HOST_PORT_RANGE_START: optionalNumberEnv,
    JUPYTER_HOST_PORT_RANGE_END: optionalNumberEnv,
    JUPYTER_PUBLIC_BASE_PATH: stringEnv('/api/notebooks/proxy', normalizePath)
});

export const loadConfig = (): DaemonConfig => {
    const env = envSchema.parse(process.env);

    return {
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
        minio: {
            endpoint: env.MINIO_ENDPOINT,
            accessKey: env.MINIO_ACCESS_KEY,
            secretKey: env.MINIO_SECRET_KEY,
            useSSL: env.MINIO_USE_SSL
        },
        mongodbUri: env.MONGODB_URI,
        redis: {
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            username: env.REDIS_USERNAME,
            password: env.REDIS_PASSWORD
        },
        jupyter: {
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
        },
        allowedBuckets: [
            ObjectBucketName.Dumps,
            ObjectBucketName.Models,
            ObjectBucketName.Plugins,
            ObjectBucketName.Rasterizer
        ]
    };
};
