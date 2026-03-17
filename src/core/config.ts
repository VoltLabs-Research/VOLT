import { ObjectBucketName } from '@/shared/contracts';

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

export interface QueueConcurrencyConfig {
    analysis: number;
    glbPreprocessing: number;
    rasterizer: number;
};

export interface DaemonConfig {
    port: number;
    host: string;
    teamClusterId: string;
    daemonPassword: string;
    enrollmentToken?: string;
    installedVersion: string;
    voltCloudUrl: string;
    heartbeatPath: string;
    lifecyclePath: string;
    healthcheckPath?: string;
    deleteCompletionPath?: string;
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
    queueConcurrency: QueueConcurrencyConfig;
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

const readJupyterHostPortRange = (): JupyterHostPortRange | undefined => {
    const start = readOptionalNumber('JUPYTER_HOST_PORT_RANGE_START');
    const end = readOptionalNumber('JUPYTER_HOST_PORT_RANGE_END');

    if (start === undefined && end === undefined) {
        return undefined;
    }

    if (start === undefined || end === undefined) {
        throw new Error('JUPYTER_HOST_PORT_RANGE_START and JUPYTER_HOST_PORT_RANGE_END must be set together');
    }

    if (start <= 0 || end <= 0) {
        throw new Error('JUPYTER host port range values must be positive numbers');
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
        teamClusterId: readRequiredString('TEAM_CLUSTER_ID'),
        daemonPassword: readRequiredString('TEAM_CLUSTER_DAEMON_PASSWORD'),
        enrollmentToken: readOptionalString('TEAM_CLUSTER_ENROLLMENT_TOKEN'),
        installedVersion: process.env.VOLT_CLUSTER_INSTALL_MANIFEST_VERSION?.trim() || '1.0.0',
        voltCloudUrl,
        heartbeatPath: readRequiredString('TEAM_CLUSTER_HEARTBEAT_PATH'),
        lifecyclePath: readRequiredString('TEAM_CLUSTER_LIFECYCLE_PATH'),
        healthcheckPath: readOptionalString('TEAM_CLUSTER_HEALTHCHECK_PATH'),
        deleteCompletionPath: readOptionalString('TEAM_CLUSTER_DELETE_COMPLETION_PATH'),
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
        ],
        // TODO:
        queueConcurrency: {
            analysis: readNumber('ANALYSIS_CONCURRENCY', 5),
            glbPreprocessing: readNumber('GLB_CONCURRENCY', 5),
            rasterizer: readNumber('RASTER_CONCURRENCY', 3)
        }
    };
};
