import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import Module from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';

const TEST_BUCKET = 'volt-models';
const TEST_OBJECT_KEY = 'missing.glb';
const TEST_CLUSTER_ID = 'cluster-1';
const TEST_DAEMON_PASSWORD = 'secret';
const TEST_DIRECT_ACCESS_HEADER = 'x-team-cluster-direct-access-token';

class StubMinioService {
    public readonly deletedPrefixes: Array<{ bucket: string; prefix: string; }> = [];
    public readonly deletedObjects: Array<{ bucket: string; objectKey: string; }> = [];
    public statObjectCalls = 0;
    public getObjectStreamCalls = 0;
    public objectBody: Buffer | null = null;

    listBuckets(): string[] {
        return [TEST_BUCKET];
    }

    async listObjectsPage(): Promise<{ keys: string[]; }> {
        return { keys: [] };
    }

    async deleteByPrefix(bucket: string, prefix: string): Promise<number> {
        this.deletedPrefixes.push({ bucket, prefix });
        return 0;
    }

    async statObject() {
        this.statObjectCalls += 1;
        return {
            size: 16,
            etag: 'etag',
            lastModified: new Date(),
            metaData: {
                'content-type': 'model/gltf-binary'
            }
        };
    }

    async getObjectStream() {
        this.getObjectStreamCalls += 1;
        if (this.objectBody) {
            return Readable.from([this.objectBody]);
        }

        throw {
            code: 'NoSuchKey'
        };
    }

    async putObjectStream(): Promise<void> {}
    async removeObject(bucket: string, objectKey: string): Promise<void> {
        this.deletedObjects.push({ bucket, objectKey });
    }
}

class ReadServingOnlyRuntimeCapabilityGuard {
    public readonly readCommands: string[] = [];
    public readonly writeCommands: string[] = [];

    ensureServesStorageReads(command: string): void {
        this.readCommands.push(command);
    }

    ensureAcceptsStorageWrites(command: string): void {
        this.writeCommands.push(command);
        throw new Error(`Unexpected storage write capability check for ${command}`);
    }
}

const ensureDaemonTestNodePath = async (): Promise<void> => {
    const stubRoot = path.join(os.tmpdir(), 'daemon-client-stub');
    const stubModuleDirectory = path.join(stubRoot, '@voltstack', 'daemon-cluster-client');
    await fs.mkdir(stubModuleDirectory, { recursive: true });
    await fs.writeFile(
        path.join(stubModuleDirectory, 'index.js'),
        [
            'exports.DaemonSocketEvent = {',
            "  RuntimeLifecycle: 'runtime-lifecycle',",
            "  RuntimeProgress: 'runtime-progress'",
            '};'
        ].join('\n'),
        'utf8'
    );

    process.env.NODE_PATH = [
        stubRoot,
        path.resolve(process.cwd(), '../Volt/server/node_modules'),
        process.env.NODE_PATH || ''
    ].filter(Boolean).join(path.delimiter);
    (Module as any)._initPaths();
};

const request = async (
    port: number,
    path: string,
    method: string = 'GET',
    token?: string,
    extraHeaders?: Record<string, string>
): Promise<{ statusCode: number; body: string; }> => {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            method,
            path,
            headers: {
                ...(token ? {
                    [TEST_DIRECT_ACCESS_HEADER]: token
                } : {}),
                ...(extraHeaders || {})
            }
        }, async (response) => {
            const chunks: Buffer[] = [];
            for await (const chunk of response) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }

            resolve({
                statusCode: response.statusCode || 0,
                body: Buffer.concat(chunks).toString('utf8')
            });
        });

        req.once('error', reject);
        req.end();
    });
};

const createDirectAccessToken = (secret: string): string => {
    const payload = Buffer.from(JSON.stringify({
        requesterKind: 'daemon',
        requesterId: 'cluster-requester',
        ownerClusterId: TEST_CLUSTER_ID,
        teamId: 'team-1',
        exposureId: 'daemon:object-gateway',
        exposureName: 'object-gateway',
        accessMode: 'http',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60
    }), 'utf8').toString('base64url');

    const signature = createHmac('sha256', secret)
        .update(payload)
        .digest('base64url');

    return `${payload}.${signature}`;
};

test('ObjectGatewayServer maps missing GET objects to 404 instead of 500', async () => {
    await ensureDaemonTestNodePath();
    const { ObjectGatewayServer } = await import('./ObjectGatewayServer');
    const { ObjectGatewayTelemetryService } = await import('./ObjectGatewayTelemetryService');
    const server = new ObjectGatewayServer({
        port: 0,
        host: '127.0.0.1',
        teamId: 'team-1',
        objectGatewayEnabled: true,
        teamClusterId: TEST_CLUSTER_ID,
        daemonPassword: TEST_DAEMON_PASSWORD,
        installedVersion: '1.0.0',
        voltCloudUrl: 'http://localhost:3000',
        heartbeatIntervalMs: 10_000,
        metricsIntervalMs: 3_000,
        minio: {
            endpoint: 'http://localhost:9000',
            accessKey: 'minio',
            secretKey: 'minio123',
            useSSL: false
        },
        mongodbUri: 'mongodb://localhost:27017/test',
        redis: {
            host: 'localhost',
            port: 6379
        },
        jupyter: {
            image: 'image',
            memoryInMegabytes: 1024,
            cpus: 1,
            execTimeoutMs: 1000,
            notebookRoot: '/',
            port: 8888,
            token: 'token',
            uiPath: '/lab',
            frameAncestors: '*',
            startTimeoutMs: 1_000,
            publicBasePath: '/lab'
        },
        allowedBuckets: [TEST_BUCKET as any]
    }, new StubMinioService() as any, new ObjectGatewayTelemetryService());

    await server.start();

    try {
        const exposure = server.getExposure();
        const result = await request(
            exposure.targetPort,
            `/internal/object-gateway/v1/buckets/${encodeURIComponent(TEST_BUCKET)}/objects/${encodeURIComponent(TEST_OBJECT_KEY)}`,
            'GET',
            createDirectAccessToken(TEST_DAEMON_PASSWORD)
        );

        assert.equal(result.statusCode, 404);
        assert.match(result.body, /Object not found/);
    } finally {
        await server.stop();
    }
});

test('ObjectGatewayServer skips statObject on fast-path GET requests', async () => {
    await ensureDaemonTestNodePath();
    const { ObjectGatewayServer } = await import('./ObjectGatewayServer');
    const { ObjectGatewayTelemetryService } = await import('./ObjectGatewayTelemetryService');
    const minioService = new StubMinioService();
    minioService.objectBody = Buffer.from('stream-only-payload');
    const server = new ObjectGatewayServer({
        port: 0,
        host: '127.0.0.1',
        teamId: 'team-1',
        objectGatewayEnabled: true,
        teamClusterId: TEST_CLUSTER_ID,
        daemonPassword: TEST_DAEMON_PASSWORD,
        installedVersion: '1.0.0',
        voltCloudUrl: 'http://localhost:3000',
        heartbeatIntervalMs: 10_000,
        metricsIntervalMs: 3_000,
        minio: {
            endpoint: 'http://localhost:9000',
            accessKey: 'minio',
            secretKey: 'minio123',
            useSSL: false
        },
        mongodbUri: 'mongodb://localhost:27017/test',
        redis: {
            host: 'localhost',
            port: 6379
        },
        jupyter: {
            image: 'image',
            memoryInMegabytes: 1024,
            cpus: 1,
            execTimeoutMs: 1000,
            notebookRoot: '/',
            port: 8888,
            token: 'token',
            uiPath: '/lab',
            frameAncestors: '*',
            startTimeoutMs: 1_000,
            publicBasePath: '/lab'
        },
        allowedBuckets: [TEST_BUCKET as any]
    }, minioService as any, new ObjectGatewayTelemetryService());

    await server.start();

    try {
        const exposure = server.getExposure();
        const result = await request(
            exposure.targetPort,
            `/internal/object-gateway/v1/buckets/${encodeURIComponent(TEST_BUCKET)}/objects/${encodeURIComponent(TEST_OBJECT_KEY)}`,
            'GET',
            createDirectAccessToken(TEST_DAEMON_PASSWORD),
            {
                'x-volt-object-store-skip-metadata': '1'
            }
        );

        assert.equal(result.statusCode, 200);
        assert.equal(result.body, 'stream-only-payload');
        assert.equal(minioService.statObjectCalls, 0);
        assert.equal(minioService.getObjectStreamCalls, 1);
    } finally {
        await server.stop();
    }
});

test('ObjectGatewayServer allows cleanup deletes when the cluster serves residual storage reads', async () => {
    await ensureDaemonTestNodePath();
    const { ObjectGatewayServer } = await import('./ObjectGatewayServer');
    const { ObjectGatewayTelemetryService } = await import('./ObjectGatewayTelemetryService');
    const minioService = new StubMinioService();
    const capabilityGuard = new ReadServingOnlyRuntimeCapabilityGuard();
    const server = new ObjectGatewayServer({
        port: 0,
        host: '127.0.0.1',
        teamId: 'team-1',
        objectGatewayEnabled: true,
        teamClusterId: TEST_CLUSTER_ID,
        daemonPassword: TEST_DAEMON_PASSWORD,
        installedVersion: '1.0.0',
        voltCloudUrl: 'http://localhost:3000',
        heartbeatIntervalMs: 10_000,
        metricsIntervalMs: 3_000,
        minio: {
            endpoint: 'http://localhost:9000',
            accessKey: 'minio',
            secretKey: 'minio123',
            useSSL: false
        },
        mongodbUri: 'mongodb://localhost:27017/test',
        redis: {
            host: 'localhost',
            port: 6379
        },
        jupyter: {
            image: 'image',
            memoryInMegabytes: 1024,
            cpus: 1,
            execTimeoutMs: 1000,
            notebookRoot: '/',
            port: 8888,
            token: 'token',
            uiPath: '/lab',
            frameAncestors: '*',
            startTimeoutMs: 1_000,
            publicBasePath: '/lab'
        },
        allowedBuckets: [TEST_BUCKET as any]
    }, minioService as any, new ObjectGatewayTelemetryService(), capabilityGuard as any);

    await server.start();

    try {
        const exposure = server.getExposure();
        const token = createDirectAccessToken(TEST_DAEMON_PASSWORD);
        const deletePrefixResult = await request(
            exposure.targetPort,
            `/internal/object-gateway/v1/buckets/${encodeURIComponent(TEST_BUCKET)}/objects?prefix=trajectory-1/`,
            'DELETE',
            token
        );
        const deleteObjectResult = await request(
            exposure.targetPort,
            `/internal/object-gateway/v1/buckets/${encodeURIComponent(TEST_BUCKET)}/objects/${encodeURIComponent(TEST_OBJECT_KEY)}`,
            'DELETE',
            token
        );

        assert.equal(deletePrefixResult.statusCode, 200);
        assert.equal(deleteObjectResult.statusCode, 204);
        assert.deepEqual(capabilityGuard.readCommands, [
            'object-gateway.delete-prefix',
            'object-gateway.delete'
        ]);
        assert.deepEqual(capabilityGuard.writeCommands, []);
        assert.deepEqual(minioService.deletedPrefixes, [
            {
                bucket: TEST_BUCKET,
                prefix: 'trajectory-1/'
            }
        ]);
        assert.deepEqual(minioService.deletedObjects, [
            {
                bucket: TEST_BUCKET,
                objectKey: TEST_OBJECT_KEY
            }
        ]);
    } finally {
        await server.stop();
    }
});
