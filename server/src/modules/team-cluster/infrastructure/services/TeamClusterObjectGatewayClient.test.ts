import 'reflect-metadata';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import TeamClusterObjectGatewayClient from './TeamClusterObjectGatewayClient';
import { TeamClusterServiceExposureAccessMode, TeamClusterServiceExposureSourceKind, TeamClusterServiceExposureStatus } from '../../utilities/teamClusterSocket';

type StoredObject = {
    body: Buffer;
    contentType?: string;
};

const TEST_CLUSTER_ID = 'cluster-1';
const TEST_BUCKET = 'volt-models';
const TEST_OBJECT_KEY = 'path/to/object.glb';

class FakeTeamClusterDaemonClient {
    constructor(private readonly port: number) {}

    async openTunnel(): Promise<net.Socket> {
        return net.connect(this.port, '127.0.0.1');
    }
}

class FakeExposureRegistryService {
    constructor(private readonly port: number) {}

    findTeamClusterExposure(_teamClusterId: string, predicate: (exposure: any) => boolean) {
        const exposure = {
            id: 'daemon:object-gateway',
            teamClusterId: TEST_CLUSTER_ID,
            teamId: 'team-1',
            sourceKind: TeamClusterServiceExposureSourceKind.Daemon,
            exposureName: 'object-gateway',
            accessModes: [TeamClusterServiceExposureAccessMode.Http],
            targetHost: '127.0.0.1',
            targetPort: this.port,
            status: TeamClusterServiceExposureStatus.Active,
            labels: {
                'volt.exposure.service': 'object-gateway'
            }
        };

        return predicate(exposure)
            ? exposure
            : null;
    }
}

const buildObjectId = (bucket: string, objectKey: string): string => `${bucket}/${objectKey}`;

const readBody = async (request: http.IncomingMessage): Promise<Buffer> => {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
};

const buildObjectGatewayServer = async () => {
    const objects = new Map<string, StoredObject>();
    const requests: Array<{ method: string; path: string; }> = [];

    const server = http.createServer(async (request, response) => {
        const method = request.method || 'GET';
        const url = new URL(request.url || '/', 'http://127.0.0.1');
        requests.push({
            method,
            path: `${url.pathname}${url.search}`
        });

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
            response.end();
            return;
        }

        if (method === 'GET') {
            response.statusCode = 200;
            response.setHeader('content-length', String(storedObject.body.length));
            response.setHeader('content-type', storedObject.contentType || 'application/octet-stream');
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
        throw new Error('Failed to start object gateway test server');
    }

    return {
        server,
        requests,
        port: address.port
    };
};

const destroyClientSessions = (client: TeamClusterObjectGatewayClient): void => {
    const sessionPool = Reflect.get(client as object, 'sessionPool') as { sessionsByKey?: Map<string, Array<{ agent: http.Agent; tunnel: net.Socket; }>>; };
    const sessionsByKey = sessionPool.sessionsByKey;
    if (!sessionsByKey) {
        return;
    }

    for (const sessions of sessionsByKey.values()) {
        for (const session of sessions) {
            session.agent.destroy();
            session.tunnel.destroy();
        }
    }

    sessionsByKey.clear();
};

test('TeamClusterObjectGatewayClient performs read, write, list and delete operations over tunneled HTTP', async () => {
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_ENABLED = 'true';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_READS_ENABLED = 'true';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_WRITES_ENABLED = 'true';

    const { server, requests, port } = await buildObjectGatewayServer();
    const client = new TeamClusterObjectGatewayClient(
        new FakeTeamClusterDaemonClient(port) as any,
        new FakeExposureRegistryService(port) as any
    );

    try {
        const payload = Buffer.from('glb-payload');

        await client.putBuffer(TEST_CLUSTER_ID, {
            bucket: TEST_BUCKET,
            objectKey: TEST_OBJECT_KEY,
            buffer: payload,
            contentLength: payload.length,
            contentType: 'model/gltf-binary'
        });

        assert.equal(await client.exists(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY), true);

        const head = await client.head(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY);
        assert.equal(head.contentLength, payload.length);
        assert.equal(head.contentType, 'model/gltf-binary');

        const buffer = await client.getBuffer(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY);
        assert.deepEqual(buffer, payload);

        const list = await client.list(TEST_CLUSTER_ID, {
            bucket: TEST_BUCKET,
            prefix: 'path/to'
        });
        assert.deepEqual(list.keys, [TEST_OBJECT_KEY]);

        const deletedCount = await client.deleteByPrefix(TEST_CLUSTER_ID, TEST_BUCKET, 'path/');
        assert.equal(deletedCount, 1);
        assert.equal(await client.exists(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY), false);

        assert.ok(requests.some((entry) => entry.method === 'HEAD'));
    } finally {
        destroyClientSessions(client);
        await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
});

test('TeamClusterObjectGatewayClient honors feature flags without falling back to legacy RPC', async () => {
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_ENABLED = 'true';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_READS_ENABLED = 'false';
    process.env.TEAM_CLUSTER_OBJECT_GATEWAY_WRITES_ENABLED = 'false';

    const { server, port } = await buildObjectGatewayServer();
    const client = new TeamClusterObjectGatewayClient(
        new FakeTeamClusterDaemonClient(port) as any,
        new FakeExposureRegistryService(port) as any
    );

    try {
        await assert.rejects(
            () => client.getBuffer(TEST_CLUSTER_ID, TEST_BUCKET, TEST_OBJECT_KEY),
            (error: any) => error?.statusCode === 503
        );

        await assert.rejects(
            () => client.putBuffer(TEST_CLUSTER_ID, {
                bucket: TEST_BUCKET,
                objectKey: TEST_OBJECT_KEY,
                buffer: Buffer.from('x'),
                contentLength: 1
            }),
            (error: any) => error?.statusCode === 503
        );
    } finally {
        process.env.TEAM_CLUSTER_OBJECT_GATEWAY_READS_ENABLED = 'true';
        process.env.TEAM_CLUSTER_OBJECT_GATEWAY_WRITES_ENABLED = 'true';
        destroyClientSessions(client);
        await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
});
