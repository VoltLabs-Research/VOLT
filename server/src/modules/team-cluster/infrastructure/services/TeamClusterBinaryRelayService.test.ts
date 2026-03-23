import 'reflect-metadata';
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { once } from 'node:events';
import { writeUpgradeError } from '@shared/infrastructure/utilities/proxy-relay';
import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import TeamClusterBinaryRelayService, {
    TEAM_CLUSTER_BINARY_RELAY_PROTOCOL_HEADER,
    TEAM_CLUSTER_BINARY_RELAY_SESSION_HEADER,
    TEAM_CLUSTER_BINARY_RELAY_TOKEN_HEADER
} from './TeamClusterBinaryRelayService';
import TeamClusterBinaryRelayUpgradeService from './TeamClusterBinaryRelayUpgradeService';
import { BinaryRelaySessionRegistry } from './BinaryRelaySessionRegistry';
import { BinaryRelayTokenService } from './BinaryRelayTokenService';
import { WebSocket } from 'ws';
import type { Duplex } from 'node:stream';

const TEST_SECRET_KEY = 'binary-relay-test-secret';
const TEST_TEAM_CLUSTER_ID = 'team-cluster-1';
const TEST_SESSION_ID = 'session-1';

const waitForOpen = async (webSocket: WebSocket): Promise<void> => {
    if (webSocket.readyState === WebSocket.OPEN) {
        return;
    }

    await once(webSocket, 'open');
};

const readWebSocketMessage = async (webSocket: WebSocket): Promise<Buffer> => {
    const [data] = await once(webSocket, 'message');
    if (typeof data === 'string') {
        return Buffer.from(data);
    }

    if (Buffer.isBuffer(data)) {
        return data;
    }

    if (Array.isArray(data)) {
        return Buffer.concat(data.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    }

    return Buffer.from(data as ArrayBufferLike);
};

test('TeamClusterBinaryRelayService attaches websocket sessions and forwards bytes in both directions', async () => {
    process.env.SECRET_KEY = TEST_SECRET_KEY;

    const sessionRegistry = new BinaryRelaySessionRegistry();
    const tokenService = new BinaryRelayTokenService();
    const binaryRelayService = new TeamClusterBinaryRelayService(sessionRegistry, tokenService);
    const binaryRelayUpgradeService = new TeamClusterBinaryRelayUpgradeService(binaryRelayService);

    const server = http.createServer();
    server.on('upgrade', (request, socket, head) => {
        if (!binaryRelayUpgradeService.isBinaryRelayUpgradeRequest(request)) {
            (socket as Duplex).destroy();
            return;
        }

        binaryRelayUpgradeService.handleUpgrade(request, socket as Duplex, head).catch((error: unknown) => {
            writeUpgradeError(
                socket as Duplex,
                error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number'
                    ? error.statusCode
                    : 500,
                error instanceof Error ? error.message : 'Binary relay upgrade failed'
            );
        });
    });

    await new Promise<void>((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => resolve());
        server.once('error', reject);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to bind binary relay test server');
    }

    process.env.TEAM_CLUSTER_BINARY_RELAY_ENDPOINT = `http://127.0.0.1:${address.port}`;

    let localCloseCount = 0;
    const { stream, relay } = binaryRelayService.openSession({
        teamClusterId: TEST_TEAM_CLUSTER_ID,
        sessionId: TEST_SESSION_ID,
        accessMode: TeamClusterServiceExposureAccessMode.Http,
        onLocalClose: () => {
            localCloseCount += 1;
        }
    });

    const webSocket = new WebSocket(relay.relayUrl, {
        headers: {
            [TEAM_CLUSTER_BINARY_RELAY_SESSION_HEADER]: relay.relaySessionId,
            [TEAM_CLUSTER_BINARY_RELAY_TOKEN_HEADER]: relay.relayToken,
            [TEAM_CLUSTER_BINARY_RELAY_PROTOCOL_HEADER]: String(relay.relayProtocolVersion)
        }
    });

    try {
        await waitForOpen(webSocket);

        const outboundMessagePromise = readWebSocketMessage(webSocket);
        stream.write(Buffer.from('hello-relay'));
        assert.equal((await outboundMessagePromise).toString('utf8'), 'hello-relay');

        const inboundMessagePromise = once(stream, 'data').then(([chunk]) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        webSocket.send(Buffer.from('hello-stream'));
        assert.equal((await inboundMessagePromise).toString('utf8'), 'hello-stream');

        stream.destroy();
        await once(webSocket, 'close');
        assert.equal(localCloseCount, 1);
    } finally {
        if (webSocket.readyState === WebSocket.OPEN || webSocket.readyState === WebSocket.CONNECTING) {
            webSocket.close();
        }

        await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });

        delete process.env.TEAM_CLUSTER_BINARY_RELAY_ENDPOINT;
    }
});

test('TeamClusterBinaryRelayService rejects invalid relay tokens', () => {
    process.env.SECRET_KEY = TEST_SECRET_KEY;
    process.env.TEAM_CLUSTER_BINARY_RELAY_ENDPOINT = 'http://127.0.0.1:65535';

    const sessionRegistry = new BinaryRelaySessionRegistry();
    const tokenService = new BinaryRelayTokenService();
    const binaryRelayService = new TeamClusterBinaryRelayService(sessionRegistry, tokenService);
    const { relay } = binaryRelayService.openSession({
        teamClusterId: TEST_TEAM_CLUSTER_ID,
        sessionId: TEST_SESSION_ID,
        accessMode: TeamClusterServiceExposureAccessMode.Http,
        onLocalClose: () => {
        }
    });

    assert.throws(() => {
        binaryRelayService.authorizeUpgrade({
            relaySessionId: relay.relaySessionId,
            relayToken: `${relay.relayToken}.tampered`,
            relayProtocolVersion: String(relay.relayProtocolVersion)
        });
    }, (error: unknown) => {
        return typeof error === 'object'
            && error !== null
            && 'statusCode' in error
            && (error as { statusCode?: unknown }).statusCode === 401;
    });

    delete process.env.TEAM_CLUSTER_BINARY_RELAY_ENDPOINT;
});

test('TeamClusterBinaryRelayService uses VOLT_CLOUD_URL when no explicit relay endpoint is configured', () => {
    process.env.SECRET_KEY = TEST_SECRET_KEY;
    delete process.env.TEAM_CLUSTER_BINARY_RELAY_ENDPOINT;
    delete process.env.SERVER_ENDPOINT;
    process.env.VOLT_CLOUD_URL = 'https://volt.example.com';
    process.env.SERVER_HOST = '127.0.0.1';

    const sessionRegistry = new BinaryRelaySessionRegistry();
    const tokenService = new BinaryRelayTokenService();
    const binaryRelayService = new TeamClusterBinaryRelayService(sessionRegistry, tokenService);
    const { relay } = binaryRelayService.openSession({
        teamClusterId: TEST_TEAM_CLUSTER_ID,
        sessionId: TEST_SESSION_ID,
        accessMode: TeamClusterServiceExposureAccessMode.Http,
        onLocalClose: () => {
        }
    });

    assert.equal(
        relay.relayUrl,
        'wss://volt.example.com/internal/team-cluster/data-plane/v1/relay'
    );

    delete process.env.VOLT_CLOUD_URL;
    delete process.env.SERVER_HOST;
});

test('TeamClusterBinaryRelayService rejects loopback relay fallback without a reachable endpoint', () => {
    process.env.SECRET_KEY = TEST_SECRET_KEY;
    delete process.env.TEAM_CLUSTER_BINARY_RELAY_ENDPOINT;
    delete process.env.SERVER_ENDPOINT;
    delete process.env.VOLT_CLOUD_URL;
    process.env.SERVER_HOST = '127.0.0.1';

    const sessionRegistry = new BinaryRelaySessionRegistry();
    const tokenService = new BinaryRelayTokenService();
    const binaryRelayService = new TeamClusterBinaryRelayService(sessionRegistry, tokenService);

    assert.throws(() => {
        binaryRelayService.openSession({
            teamClusterId: TEST_TEAM_CLUSTER_ID,
            sessionId: TEST_SESSION_ID,
            accessMode: TeamClusterServiceExposureAccessMode.Http,
            onLocalClose: () => {
            }
        });
    }, (error: unknown) => {
        return error instanceof Error
            && 'statusCode' in error
            && (error as { statusCode?: unknown }).statusCode === 500
            && error.message.includes('Binary relay requires TEAM_CLUSTER_BINARY_RELAY_ENDPOINT');
    });

    delete process.env.SERVER_HOST;
});
