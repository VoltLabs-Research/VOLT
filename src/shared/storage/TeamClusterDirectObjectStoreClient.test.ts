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

type ProxyRequest = {
    method: string;
    path: string;
    ownerClusterId: string;
    daemonId?: string;
    daemonPassword?: string;
};

const TEST_BUCKET = 'volt-models';
const TEST_OBJECT_KEY = 'path/to/object.glb';
const TEST_OWNER_CLUSTER_ID = 'owner-cluster';
const TEST_REQUESTER_CLUSTER_ID = 'requester-cluster';
const TEST_REQUESTER_DAEMON_PASSWORD = 'requester-secret';

const buildObjectId = (bucket: string, objectKey: string): string => `${bucket}/${objectKey}`;

const readBody = async (request: http.IncomingMessage): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

const createObjectStoreProxyServer = async () => {
    const objects = new Map<string, StoredObject>();
    const requests: ProxyRequest[] = [];

    const server = http.createServer(async (request, response) => {
        const method = request.method || 'GET';
        const url = new URL(request.url || '/', 'http://127.0.0.1');
        const pathParts = url.pathname.split('/').filter(Boolean);
        const ownerClusterId = decodeURIComponent(pathParts[5] || '');
        const bucket = decodeURIComponent(pathParts[7] || '');
        const encodedObjectKey = pathParts.slice(9).join('/');
        const objectKey = decodeURIComponent(encodedObjectKey);

        requests.push({
            method,
            path: `${url.pathname}${url.search}`,
            ownerClusterId,
            daemonId: typeof request.headers['x-team-cluster-id'] === 'string'
                ? request.headers['x-team-cluster-id']
                : undefined,
            daemonPassword: typeof request.headers['x-team-cluster-daemon-password'] === 'string'
                ? request.headers['x-team-cluster-daemon-password']
                : undefined
        });

        if (method === 'GET' && pathParts.length === 9) {
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

        if (method === 'DELETE' && pathParts.length === 9) {
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
        throw new Error('Failed to bind object store proxy test server');
    }

    return {
        server,
        requests,
        url: `http://127.0.0.1:${address.port}`,
        seedObject: (bucket: string, objectKey: string, object: StoredObject) => {
            objects.set(buildObjectId(bucket, objectKey), object);
        }
    };
};

const createClient = (voltCloudUrl: string): TeamClusterDirectObjectStoreClient => {
    return new TeamClusterDirectObjectStoreClient({
        port: 8080,
        host: '0.0.0.0',
        teamId: 'team-1',
        objectGatewayEnabled: true,
        teamClusterId: TEST_REQUESTER_CLUSTER_ID,
        daemonPassword: TEST_REQUESTER_DAEMON_PASSWORD,
        installedVersion: '1.0.0',
        voltCloudUrl,
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
};

test('TeamClusterDirectObjectStoreClient reads and writes remote objects through the Volt server proxy', async () => {
    const proxyServer = await createObjectStoreProxyServer();
    const client = createClient(proxyServer.url);

    try {
        const payload = Buffer.from('glb-payload');
        await client.putBuffer(TEST_OWNER_CLUSTER_ID, {
            bucket: TEST_BUCKET,
            objectKey: TEST_OBJECT_KEY,
            buffer: payload,
            contentType: 'model/gltf-binary'
        });

        const head = await client.head(TEST_OWNER_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY);
        assert.equal(head.contentLength, payload.length);

        const buffer = await client.getBuffer(TEST_OWNER_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY);
        assert.deepEqual(buffer, payload);

        const list = await client.list(TEST_OWNER_CLUSTER_ID, {
            bucket: TEST_BUCKET,
            prefix: 'path/to'
        });
        assert.deepEqual(list.keys, [TEST_OBJECT_KEY]);

        const deletedCount = await client.deleteByPrefix(TEST_OWNER_CLUSTER_ID, TEST_BUCKET, 'path/');
        assert.equal(deletedCount, 1);

        assert.ok(proxyServer.requests.length >= 4);
        assert.ok(proxyServer.requests.every((entry) => entry.ownerClusterId === TEST_OWNER_CLUSTER_ID));
        assert.ok(proxyServer.requests.every((entry) => entry.daemonId === TEST_REQUESTER_CLUSTER_ID));
        assert.ok(proxyServer.requests.every((entry) => entry.daemonPassword === TEST_REQUESTER_DAEMON_PASSWORD));
        assert.ok(proxyServer.requests.every((entry) => {
            return entry.path.startsWith(
                `/internal/team-cluster/object-store/v1/owners/${encodeURIComponent(TEST_OWNER_CLUSTER_ID)}/buckets/${encodeURIComponent(TEST_BUCKET)}/objects`
            );
        }));
    } finally {
        await new Promise<void>((resolve, reject) => {
            proxyServer.server.close((error) => error ? reject(error) : resolve());
        });
    }
});

test('TeamClusterDirectObjectStoreClient preserves gzipped object bytes when the response advertises content-encoding', async () => {
    const proxyServer = await createObjectStoreProxyServer();
    const client = createClient(proxyServer.url);

    try {
        const compressed = zlib.gzipSync(Buffer.from('dump-payload'));
        proxyServer.seedObject(TEST_BUCKET, TEST_OBJECT_KEY, {
            body: compressed,
            contentType: 'application/gzip',
            contentEncoding: 'gzip'
        });

        const head = await client.head(TEST_OWNER_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY);
        assert.equal(head.contentEncoding, 'gzip');

        const buffer = await client.getBuffer(TEST_OWNER_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY);
        assert.deepEqual(buffer, compressed);
        assert.deepEqual(zlib.gunzipSync(buffer), Buffer.from('dump-payload'));
    } finally {
        await new Promise<void>((resolve, reject) => {
            proxyServer.server.close((error) => error ? reject(error) : resolve());
        });
    }
});
