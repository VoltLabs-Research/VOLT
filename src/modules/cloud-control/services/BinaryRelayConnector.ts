import { logger } from '@/core/logger';
import type { TeamClusterDaemonBinaryRelayDescriptor } from '@/shared/contracts/reverseChannel';
import { WebSocket } from 'ws';

const TEAM_CLUSTER_BINARY_RELAY_SESSION_HEADER = 'x-team-cluster-relay-session-id';
const TEAM_CLUSTER_BINARY_RELAY_TOKEN_HEADER = 'x-team-cluster-relay-token';
const TEAM_CLUSTER_BINARY_RELAY_PROTOCOL_HEADER = 'x-team-cluster-relay-protocol-version';

export class BinaryRelayConnector {
    connect(relay: TeamClusterDaemonBinaryRelayDescriptor): WebSocket {
        if (relay.relayProtocolVersion !== 1) {
            throw new Error(`Unsupported binary relay protocol version: ${relay.relayProtocolVersion}`);
        }

        logger.info({
            action: 'binary-relay.connector.connect',
            relaySessionId: relay.relaySessionId,
            relayUrl: relay.relayUrl
        }, 'Connecting daemon binary relay session');

        return new WebSocket(relay.relayUrl, {
            perMessageDeflate: false,
            headers: {
                [TEAM_CLUSTER_BINARY_RELAY_SESSION_HEADER]: relay.relaySessionId,
                [TEAM_CLUSTER_BINARY_RELAY_TOKEN_HEADER]: relay.relayToken,
                [TEAM_CLUSTER_BINARY_RELAY_PROTOCOL_HEADER]: String(relay.relayProtocolVersion)
            }
        });
    }
}
