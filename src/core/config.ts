import { ObjectBucketName } from '@/shared/contracts';
import type { TeamClusterDaemonRuntimeConfig } from '@/shared/contracts';

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

const readRequiredString = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} is required`);
    }

    return value;
};

const readOptionalString = (name: string): string | undefined => {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
};

const readNumber = (name: string, fallback: number): number => {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) {
        return fallback;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
        throw new Error(`${name} must be a finite number`);
    }

    return parsedValue;
};

const readOptionalNumber = (name: string): number | undefined => {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) {
        return undefined;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
        throw new Error(`${name} must be a finite number`);
    }

    return parsedValue;
};

const readBoolean = (name: string, fallback: boolean): boolean => {
    const rawValue = process.env[name]?.trim().toLowerCase();
    if (!rawValue) {
        return fallback;
    }

    return rawValue === 'true' || rawValue === '1' || rawValue === 'yes';
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

const isValidPort = (value: number): boolean => {
    return Number.isInteger(value) && value >= 1 && value <= 65535;
};

const readJupyterHostPortRange = (): JupyterHostPortRange | undefined => {
    const start = readOptionalNumber('JUPYTER_HOST_PORT_RANGE_START');
    const end = readOptionalNumber('JUPYTER_HOST_PORT_RANGE_END');

    if (start === undefined && end === undefined) {
        return undefined;
    }

    if (start === undefined || end === undefined) {
        throw new Error('JUPYTER_HOST_PORT_RANGE_START and JUPYTER_HOST_PORT_RANGE_END must be set together');
    }

    if (!isValidPort(start) || !isValidPort(end)) {
        throw new Error('JUPYTER host port range values must be integers between 1 and 65535');
    }

    if (start > end) {
        throw new Error('JUPYTER_HOST_PORT_RANGE_START must be less than or equal to JUPYTER_HOST_PORT_RANGE_END');
    }

    return { start, end };
};

export const loadConfig = (): DaemonConfig => {
    const voltCloudUrl = normalizeCloudUrl(readRequiredString('VOLT_CLOUD_URL'));
    const host = process.env.HOST?.trim() || '0.0.0.0';

    return {
        port: readNumber('PORT', 8080),
        host,
        teamId: readOptionalString('TEAM_ID') || readOptionalString('VOLT_TEAM_ID'),
        objectGatewayEnabled: readBoolean('TEAM_CLUSTER_OBJECT_GATEWAY_ENABLED', true),
        teamClusterId: readRequiredString('TEAM_CLUSTER_ID'),
        daemonPassword: readRequiredString('TEAM_CLUSTER_DAEMON_PASSWORD'),
        enrollmentToken: readOptionalString('TEAM_CLUSTER_ENROLLMENT_TOKEN'),
        installedVersion: process.env.VOLT_CLUSTER_INSTALL_MANIFEST_VERSION?.trim() || '1.0.0',
        voltCloudUrl,
        healthcheckPath: readOptionalString('TEAM_CLUSTER_HEALTHCHECK_PATH'),
        controlSocketUrl: readOptionalString('VOLT_CLOUD_DAEMON_SOCKET_URL'),
        heartbeatIntervalMs: readNumber('TEAM_CLUSTER_HEARTBEAT_INTERVAL_MS', DEFAULT_HEARTBEAT_INTERVAL_MS),
        metricsIntervalMs: readNumber('TEAM_CLUSTER_METRICS_INTERVAL_MS', DEFAULT_METRICS_INTERVAL_MS),
        composeProjectName: readOptionalString('COMPOSE_PROJECT_NAME'),
        installRoot: readOptionalString('TEAM_CLUSTER_INSTALL_ROOT'),
        minio: {
            endpoint: readRequiredString('MINIO_ENDPOINT'),
            accessKey: readRequiredString('MINIO_ACCESS_KEY'),
            secretKey: readRequiredString('MINIO_SECRET_KEY'),
            useSSL: readBoolean('MINIO_USE_SSL', false)
        },
        mongodbUri: readRequiredString('MONGODB_URI'),
        redis: {
            host: readRequiredString('REDIS_HOST'),
            port: readNumber('REDIS_PORT', 6379),
            username: readOptionalString('REDIS_USERNAME'),
            password: readOptionalString('REDIS_PASSWORD')
        },
        jupyter: {
            image: process.env.JUPYTER_IMAGE?.trim() || DEFAULT_JUPYTER_IMAGE,
            memoryInMegabytes: readNumber('JUPYTER_CONTAINER_MEMORY_MB', 2048),
            cpus: readNumber('JUPYTER_CONTAINER_CPUS', 2),
            execTimeoutMs: readNumber('JUPYTER_EXEC_TIMEOUT_MS', 45_000),
            notebookRoot: normalizePath(process.env.JUPYTER_NOTEBOOK_ROOT?.trim() || '/home/jovyan/work/volt-notebooks'),
            port: readNumber('JUPYTER_PORT', 8888),
            token: process.env.JUPYTER_TOKEN?.trim() || 'volt-scripting',
            uiPath: normalizePath(process.env.JUPYTER_UI_PATH?.trim() || '/lab'),
            frameAncestors: process.env.JUPYTER_FRAME_ANCESTORS?.trim() || '*',
            startTimeoutMs: readNumber('JUPYTER_START_TIMEOUT_MS', 60_000),
            hostPortRange: readJupyterHostPortRange(),
            publicBasePath: normalizePath(process.env.JUPYTER_PUBLIC_BASE_PATH?.trim() || '/api/notebooks/proxy')
        },
        allowedBuckets: [
            ObjectBucketName.Dumps,
            ObjectBucketName.Models,
            ObjectBucketName.Plugins,
            ObjectBucketName.Rasterizer
        ]
    };
};
