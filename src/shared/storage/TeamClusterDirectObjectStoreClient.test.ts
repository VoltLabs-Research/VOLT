import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import zlib from 'node:zlib';
import { TeamClusterDirectObjectStoreClient } from './TeamClusterDirectObjectStoreClient';

type StoredObject = {
    body: Buffer;
    contentType?: string;
    contentEncoding?: string;
};

const TEST_BUCKET = 'volt-models';
const TEST_OBJECT_KEY = 'path/to/object.glb';
const TEST_DIRECT_ACCESS_TOKEN = 'direct-access-token';

const buildObjectId = (bucket: string, objectKey: string): string => `${bucket}/${objectKey}`;

const readBody = async (request: http.IncomingMessage): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

const createObjectGatewayServer = async () => {
    const objects = new Map<string, StoredObject>();
    const receivedTokens: string[] = [];

    const server = http.createServer(async (request, response) => {
        if (typeof request.headers['x-team-cluster-direct-access-token'] === 'string') {
            receivedTokens.push(request.headers['x-team-cluster-direct-access-token']);
        }

        const method = request.method || 'GET';
        const url = new URL(request.url || '/', 'http://127.0.0.1');
        const pathParts = url.pathname.split('/').filter(Boolean);
        const bucket = decodeURIComponent(pathParts[4] || '');
        const encodedObjectKey = pathParts.slice(6).join('/');
        const objectKey = decodeURIComponent(encodedObjectKey);

        if (method === 'GET' && pathParts.length === 6) {
            const prefix = url.searchParams.get('prefix') || '';
            const keys = Array.from(objects.keys())
                .filter((key) => key.startsWith(`${bucket}/${prefix}`))
                .map((key) => key.slice(bucket.length + 1));

            const body = Buffer.from(JSON.stringify({ keys }));
            response.statusCode = 200;
            response.setHeader('content-type', 'application/json');
            response.setHeader('content-length', String(body.length));
            response.end(body);
            return;
        }

        if (method === 'DELETE' && pathParts.length === 6) {
            const prefix = url.searchParams.get('prefix') || '';
            const matchingKeys = Array.from(objects.keys()).filter((key) => key.startsWith(`${bucket}/${prefix}`));
            for (const key of matchingKeys) {
                objects.delete(key);
            }

            const body = Buffer.from(JSON.stringify({ deletedCount: matchingKeys.length }));
            response.statusCode = 200;
            response.setHeader('content-type', 'application/json');
            response.setHeader('content-length', String(body.length));
            response.end(body);
            return;
        }

        if (method === 'PUT') {
            const body = await readBody(request);
            objects.set(buildObjectId(bucket, objectKey), {
                body,
                contentType: typeof request.headers['content-type'] === 'string'
                    ? request.headers['content-type']
                    : undefined,
                contentEncoding: typeof request.headers['content-encoding'] === 'string'
                    ? request.headers['content-encoding']
                    : undefined
            });
            response.statusCode = 201;
            response.end();
            return;
        }

        const storedObject = objects.get(buildObjectId(bucket, objectKey));
        if (!storedObject) {
            const body = Buffer.from(JSON.stringify({ message: 'missing' }));
            response.statusCode = 404;
            response.setHeader('content-type', 'application/json');
            response.setHeader('content-length', String(body.length));
            response.end(body);
            return;
        }

        if (method === 'HEAD') {
            response.statusCode = 200;
            response.setHeader('content-length', String(storedObject.body.length));
            response.setHeader('content-type', storedObject.contentType || 'application/octet-stream');
            if (storedObject.contentEncoding) {
                response.setHeader('content-encoding', storedObject.contentEncoding);
            }
            response.end();
            return;
        }

        if (method === 'GET') {
            response.statusCode = 200;
            response.setHeader('content-length', String(storedObject.body.length));
            response.setHeader('content-type', storedObject.contentType || 'application/octet-stream');
            if (storedObject.contentEncoding) {
                response.setHeader('content-encoding', storedObject.contentEncoding);
            }
            response.end(storedObject.body);
            return;
        }

        if (method === 'DELETE') {
            objects.delete(buildObjectId(bucket, objectKey));
            response.statusCode = 204;
            response.end();
            return;
        }

        response.statusCode = 405;
        response.end();
    });

    await new Promise<void>((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => resolve());
        server.once('error', reject);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to bind direct object gateway test server');
    }

    return {
        server,
        port: address.port,
        receivedTokens,
        seedObject: (bucket: string, objectKey: string, object: StoredObject) => {
            objects.set(buildObjectId(bucket, objectKey), object);
        }
    };
};

const createVoltGrantServer = async (objectGatewayPort: number) => {
    let grantRequests = 0;

    const server = http.createServer(async (request, response) => {
        if (request.method !== 'POST' || request.url !== '/internal/team-cluster/direct-access/v1/grants') {
            response.statusCode = 404;
            response.end();
            return;
        }

        grantRequests += 1;
        const body = Buffer.from(JSON.stringify({
            ownerClusterId: 'owner-cluster',
            exposureName: 'object-gateway',
            exposureId: 'daemon:object-gateway',
            accessMode: 'http',
            endpoint: {
                protocol: 'http',
                host: '127.0.0.1',
                port: objectGatewayPort
            },
            token: TEST_DIRECT_ACCESS_TOKEN,
            expiresAt: new Date(Date.now() + 60_000).toISOString()
        }));

        response.statusCode = 200;
        response.setHeader('content-type', 'application/json');
        response.setHeader('content-length', String(body.length));
        response.end(body);
    });

    await new Promise<void>((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => resolve());
        server.once('error', reject);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to bind direct grant test server');
    }

    return {
        server,
        grantRequests,
        getGrantRequests: () => grantRequests,
        url: `http://127.0.0.1:${address.port}`
    };
};

test('TeamClusterDirectObjectStoreClient reads and writes remote objects through direct peer access', async () => {
    const objectGateway = await createObjectGatewayServer();
    const voltGrantServer = await createVoltGrantServer(objectGateway.port);
    const client = new TeamClusterDirectObjectStoreClient({
        port: 8080,
        host: '0.0.0.0',
        teamId: 'team-1',
        objectGatewayEnabled: true,
        teamClusterId: 'requester-cluster',
        daemonPassword: 'requester-secret',
        installedVersion: '1.0.0',
        voltCloudUrl: voltGrantServer.url,
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
    });

    try {
        const payload = Buffer.from('glb-payload');
        await client.putBuffer('owner-cluster', {
            bucket: TEST_BUCKET,
            objectKey: TEST_OBJECT_KEY,
            buffer: payload,
            contentType: 'model/gltf-binary'
        });

        const head = await client.head('owner-cluster', TEST_BUCKET, TEST_OBJECT_KEY);
        assert.equal(head.contentLength, payload.length);

        const buffer = await client.getBuffer('owner-cluster', TEST_BUCKET, TEST_OBJECT_KEY);
        assert.deepEqual(buffer, payload);

        const list = await client.list('owner-cluster', {
            bucket: TEST_BUCKET,
            prefix: 'path/to'
        });
        assert.deepEqual(list.keys, [TEST_OBJECT_KEY]);

        const deletedCount = await client.deleteByPrefix('owner-cluster', TEST_BUCKET, 'path/');
        assert.equal(deletedCount, 1);
        assert.equal(voltGrantServer.getGrantRequests(), 1);
        assert.ok(objectGateway.receivedTokens.every((token) => token === TEST_DIRECT_ACCESS_TOKEN));
    } finally {
        await new Promise<void>((resolve, reject) => {
            objectGateway.server.close((error) => error ? reject(error) : resolve());
        });
        await new Promise<void>((resolve, reject) => {
            voltGrantServer.server.close((error) => error ? reject(error) : resolve());
        });
    }
});

test('TeamClusterDirectObjectStoreClient preserves gzipped object bytes when the response advertises content-encoding', async () => {
    const objectGateway = await createObjectGatewayServer();
    const voltGrantServer = await createVoltGrantServer(objectGateway.port);
    const client = new TeamClusterDirectObjectStoreClient({
        port: 8080,
        host: '0.0.0.0',
        teamId: 'team-1',
        objectGatewayEnabled: true,
        teamClusterId: 'requester-cluster',
        daemonPassword: 'requester-secret',
        installedVersion: '1.0.0',
        voltCloudUrl: voltGrantServer.url,
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
    });

    try {
        const compressed = zlib.gzipSync(Buffer.from('dump-payload'));
        objectGateway.seedObject(TEST_BUCKET, TEST_OBJECT_KEY, {
            body: compressed,
            contentType: 'application/gzip',
            contentEncoding: 'gzip'
        });

        const head = await client.head('owner-cluster', TEST_BUCKET, TEST_OBJECT_KEY);
        assert.equal(head.contentEncoding, 'gzip');

        const buffer = await client.getBuffer('owner-cluster', TEST_BUCKET, TEST_OBJECT_KEY);
        assert.deepEqual(buffer, compressed);
        assert.deepEqual(zlib.gunzipSync(buffer), Buffer.from('dump-payload'));
    } finally {
        await new Promise<void>((resolve, reject) => {
            objectGateway.server.close((error) => error ? reject(error) : resolve());
        });
        await new Promise<void>((resolve, reject) => {
            voltGrantServer.server.close((error) => error ? reject(error) : resolve());
        });
    }
});
