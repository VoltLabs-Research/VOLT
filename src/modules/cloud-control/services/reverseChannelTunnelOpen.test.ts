import assert from 'node:assert/strict';
import test from 'node:test';
import { TeamClusterServiceExposureAccessMode } from '../../../shared/contracts/serviceExposure';
import { readTunnelOpenPayload } from './reverseChannelTunnelOpen';

test('readTunnelOpenPayload preserves a valid binary relay descriptor', () => {
    const payload = readTunnelOpenPayload({
        type: 'tunnel-open',
        sessionId: 'session-1',
        exposureId: 'exposure-1',
        accessMode: TeamClusterServiceExposureAccessMode.Http,
        relay: {
            relaySessionId: 'relay-1',
            relayUrl: 'ws://127.0.0.1/internal/team-cluster/data-plane/v1/relay',
            relayToken: 'token-1',
            relayProtocolVersion: 1
        }
    } as any);

    assert.deepEqual(payload, {
        type: 'tunnel-open',
        sessionId: 'session-1',
        exposureId: 'exposure-1',
        accessMode: TeamClusterServiceExposureAccessMode.Http,
        relay: {
            relaySessionId: 'relay-1',
            relayUrl: 'ws://127.0.0.1/internal/team-cluster/data-plane/v1/relay',
            relayToken: 'token-1',
            relayProtocolVersion: 1
        }
    });
});

test('readTunnelOpenPayload rejects an invalid binary relay descriptor', () => {
    const payload = readTunnelOpenPayload({
        type: 'tunnel-open',
        sessionId: 'session-1',
        exposureId: 'exposure-1',
        accessMode: TeamClusterServiceExposureAccessMode.Http,
        relay: {
            relaySessionId: '',
            relayUrl: 'ws://127.0.0.1/internal/team-cluster/data-plane/v1/relay',
            relayToken: 'token-1',
            relayProtocolVersion: 1
        }
    } as any);

    assert.equal(payload, null);
});
