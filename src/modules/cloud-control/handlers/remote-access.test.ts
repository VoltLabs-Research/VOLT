import { createRemoteAccessHandlers, joinExplorerPathSegments } from './remote-access';
import { MinioService, RedisExplorerReadService } from '@/modules/platform/services';
import { ObjectBucketName } from '@/shared/contracts';
import { TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND } from '@/shared/contracts/reverseChannel';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { DaemonConfig } from '@/core/config';

interface MinioListObjectsCall {
    bucket: string;
    prefix: string;
};

interface RedisListExplorerKeysCall {
    databaseId: number;
    limit: number | undefined;
};

interface RedisGetExplorerValueCall {
    databaseId: number;
    key: string;
};

interface RedisDatabaseSummary {
    databaseId: number;
    keyCount: number;
};

interface RemoteExplorerEntrySnapshot {
    name: string;
    path: string;
    type: string;
};

interface HandlerDependencies {
    minioService?: MinioService;
    redisExplorerReadService?: RedisExplorerReadService;
};

const TEST_CONFIG: DaemonConfig = {
    port: 3000,
    host: '127.0.0.1',
    teamClusterId: 'team-cluster-id',
    daemonPassword: 'daemon-password',
    enrollmentToken: 'enrollment-token',
    installedVersion: '1.0.0',
    voltCloudUrl: 'https://volt.example.com',
    healthcheckPath: '/health',
    controlSocketUrl: 'wss://volt.example.com/control',
    heartbeatIntervalMs: 10_000,
    metricsIntervalMs: 3_000,
    composeProjectName: 'cluster-daemon',
    installRoot: '/tmp/cluster-daemon',
    minio: {
        endpoint: 'http://127.0.0.1:9000',
        accessKey: 'minio-access-key',
        secretKey: 'minio-secret-key',
        useSSL: false
    },
    mongodbUri: 'mongodb://127.0.0.1:27017/cluster-daemon',
    redis: {
        host: '127.0.0.1',
        port: 6379,
        username: 'redis-user',
        password: 'redis-password'
    },
    jupyter: {
        image: 'volt/jupyter:latest',
        memoryInMegabytes: 1024,
        cpus: 1,
        execTimeoutMs: 60_000,
        notebookRoot: '/workspace',
        port: 8888,
        token: 'jupyter-token',
        uiPath: '/lab',
        frameAncestors: '\'self\'',
        startTimeoutMs: 60_000,
        hostPortRange: {
            start: 10_000,
            end: 10_100
        },
        publicBasePath: '/jupyter'
    },
    allowedBuckets: [
        ObjectBucketName.Plugins
    ],
    queueConcurrency: {
        analysis: 1,
        glbPreprocessing: 3,
        rasterizer: 2
    }
};

class TestMinioService extends MinioService {
    public readonly listObjectsCalls: MinioListObjectsCall[] = [];

    constructor(
        private readonly objectKeysByPrefix: Map<string, string[]> = new Map()
    ) {
        super(TEST_CONFIG);
    }

    override listBuckets(): string[] {
        return TEST_CONFIG.allowedBuckets;
    }

    override async listObjects(bucket: string, prefix: string): Promise<string[]> {
        this.listObjectsCalls.push({
            bucket,
            prefix
        });

        return this.objectKeysByPrefix.get(prefix) ?? [];
    }
};

class TestRedisExplorerReadService extends RedisExplorerReadService {
    public readonly listExplorerKeysCalls: RedisListExplorerKeysCall[] = [];
    public readonly getExplorerValueCalls: RedisGetExplorerValueCall[] = [];

    constructor(
        private readonly keysByDatabaseId: Map<number, string[]> = new Map(),
        private readonly valuesByLookup: Map<string, unknown> = new Map()
    ) {
        super(TEST_CONFIG);
    }

    override async listDatabases(): Promise<RedisDatabaseSummary[]> {
        return Array.from(this.keysByDatabaseId.entries()).map(([databaseId, keys]) => ({
            databaseId,
            keyCount: keys.length
        }));
    }

    override async listKeys(databaseId: number, limit = 200): Promise<string[]> {
        this.listExplorerKeysCalls.push({
            databaseId,
            limit
        });

        return this.keysByDatabaseId.get(databaseId) ?? [];
    }

    override async getValue(databaseId: number, key: string): Promise<{ type: string; value: unknown; }> {
        this.getExplorerValueCalls.push({
            databaseId,
            key
        });

        return {
            type: 'string',
            value: this.valuesByLookup.get(`${databaseId}:${key}`) ?? null
        };
    }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const readRequiredString = (value: unknown, fieldName: string): string => {
    if (typeof value !== 'string') {
        assert.fail(`${fieldName} must be a string`);
    }

    return value;
};

const readExplorerEntries = (value: unknown): RemoteExplorerEntrySnapshot[] => {
    assert.ok(Array.isArray(value), 'remote explorer result must be an array');

    return value.map((entry) => {
        assert.ok(isRecord(entry), 'remote explorer entry must be an object');

        const name = readRequiredString(entry.name, 'entry.name');
        const path = readRequiredString(entry.path, 'entry.path');
        const type = readRequiredString(entry.type, 'entry.type');

        return {
            name,
            path,
            type
        };
    });
};

const findExplorerEntry = (
    entries: RemoteExplorerEntrySnapshot[],
    path: string
): RemoteExplorerEntrySnapshot => {
    const entry = entries.find((candidate) => candidate.path === path);

    assert.ok(entry, `Expected explorer entry for path "${path}"`);
    return entry;
};

const createListHandler = (deps: HandlerDependencies) => {
    const handlers = createRemoteAccessHandlers({
        minioService: deps.minioService ?? new TestMinioService(),
        redisExplorerReadService: deps.redisExplorerReadService ?? new TestRedisExplorerReadService()
    });
    const handler = handlers.find((candidate) => candidate.command === TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND.list);

    assert.ok(handler, `Expected ${TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND.list} handler`);
    return handler;
};

const createNodeHandler = (deps: HandlerDependencies) => {
    const handlers = createRemoteAccessHandlers({
        minioService: deps.minioService ?? new TestMinioService(),
        redisExplorerReadService: deps.redisExplorerReadService ?? new TestRedisExplorerReadService()
    });
    const handler = handlers.find((candidate) => candidate.command === TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND.node);

    assert.ok(handler, `Expected ${TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND.node} handler`);
    return handler;
};

test('joinExplorerPathSegments keeps bucket and child directory separated', () => {
    assert.equal(
        joinExplorerPathSegments(ObjectBucketName.Plugins, 'plugins'),
        'volt-plugins/plugins'
    );
});

test('joinExplorerPathSegments preserves nested prefixes for MinIO objects', () => {
    assert.equal(
        joinExplorerPathSegments(ObjectBucketName.Plugins, 'plugins/nested/', '/manifest.json'),
        'volt-plugins/plugins/nested/manifest.json'
    );
});

test('joinExplorerPathSegments does not reproduce malformed concatenated bucket names', () => {
    const malformedPath = joinExplorerPathSegments(ObjectBucketName.Plugins, 'plugins');

    assert.notEqual(malformedPath, 'volt-pluginsplugins');
});

test('remote.explorer.list exposes the MinIO plugin directory from the bucket root', async () => {
    const minioService = new TestMinioService(new Map([
        [
            '',
            [
                'plugins/manifest.json',
                'README.md'
            ]
        ]
    ]));
    const handler = createListHandler({
        minioService
    });

    const result = await handler.execute({
        target: 'minio',
        path: ObjectBucketName.Plugins
    });
    const entries = readExplorerEntries(result.data);

    assert.deepEqual(minioService.listObjectsCalls, [
        {
            bucket: ObjectBucketName.Plugins,
            prefix: ''
        }
    ]);

    assert.deepEqual(findExplorerEntry(entries, 'volt-plugins/plugins'), {
        name: 'plugins',
        path: 'volt-plugins/plugins',
        type: 'directory'
    });
    assert.deepEqual(findExplorerEntry(entries, 'volt-plugins/README.md'), {
        name: 'README.md',
        path: 'volt-plugins/README.md',
        type: 'object'
    });
});

test('remote.explorer.list keeps nested MinIO paths correct under volt-plugins/plugins', async () => {
    const minioService = new TestMinioService(new Map([
        [
            'plugins/',
            [
                'plugins/manifest.json',
                'plugins/nested/config.json',
                'plugins/readme.txt'
            ]
        ]
    ]));
    const handler = createListHandler({
        minioService
    });

    const result = await handler.execute({
        target: 'minio',
        path: 'volt-plugins/plugins'
    });
    const entries = readExplorerEntries(result.data);

    assert.deepEqual(minioService.listObjectsCalls, [
        {
            bucket: ObjectBucketName.Plugins,
            prefix: 'plugins/'
        }
    ]);

    assert.deepEqual(findExplorerEntry(entries, 'volt-plugins/plugins/manifest.json'), {
        name: 'manifest.json',
        path: 'volt-plugins/plugins/manifest.json',
        type: 'object'
    });
    assert.deepEqual(findExplorerEntry(entries, 'volt-plugins/plugins/nested'), {
        name: 'nested',
        path: 'volt-plugins/plugins/nested',
        type: 'directory'
    });
    assert.deepEqual(findExplorerEntry(entries, 'volt-plugins/plugins/readme.txt'), {
        name: 'readme.txt',
        path: 'volt-plugins/plugins/readme.txt',
        type: 'object'
    });
});

test('remote.explorer.node normalizes Redis key paths before fetching the value', async () => {
    const redisExplorerReadService = new TestRedisExplorerReadService(
        new Map(),
        new Map([
            [
                '4:folder/key',
                'stored-value'
            ]
        ])
    );
    const handler = createNodeHandler({
        redisExplorerReadService
    });

    const result = await handler.execute({
        target: 'redis-data',
        path: '/db/4/key/folder%2Fkey/'
    });

    assert.deepEqual(redisExplorerReadService.getExplorerValueCalls, [
        {
            databaseId: 4,
            key: 'folder/key'
        }
    ]);
    assert.deepEqual(result, {
        data: {
            path: '/db/4/key/folder%2Fkey/',
            title: 'folder/key',
            type: 'redis-value',
            contentType: 'text',
            textContent: JSON.stringify({
                type: 'string',
                value: 'stored-value'
            }, null, 2),
            mongoDocuments: []
        }
    });
});
