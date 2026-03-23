import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { WebSocketServer } from 'ws';
import type TeamClusterBinaryRelayService from './TeamClusterBinaryRelayService';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

import {
    TEAM_CLUSTER_BINARY_RELAY_PATH,
    TEAM_CLUSTER_BINARY_RELAY_PROTOCOL_HEADER,
    TEAM_CLUSTER_BINARY_RELAY_SESSION_HEADER,
    TEAM_CLUSTER_BINARY_RELAY_TOKEN_HEADER,
    type AuthorizedBinaryRelayUpgrade
} from './TeamClusterBinaryRelayService';

@injectable()
export default class TeamClusterBinaryRelayUpgradeService {
    private readonly webSocketServer = new WebSocketServer({
        noServer: true
    });

    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterBinaryRelayService)
        private readonly binaryRelayService: TeamClusterBinaryRelayService
    ) {}

    isBinaryRelayUpgradeRequest(request: IncomingMessage): boolean {
        const pathname = request.url
            ? new URL(request.url, 'http://volt.local').pathname
            : '';

        return pathname === TEAM_CLUSTER_BINARY_RELAY_PATH;
    }

    async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
        const claim = this.authorizeRequest(request);

        try {
            this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
                this.binaryRelayService.attachWebSocket(claim, webSocket);
            });
        } catch (error) {
            this.binaryRelayService.rollbackUpgrade(claim);
            throw error;
        }
    }

    private authorizeRequest(request: IncomingMessage): AuthorizedBinaryRelayUpgrade {
        const relaySessionId = this.readHeaderValue(request.headers[TEAM_CLUSTER_BINARY_RELAY_SESSION_HEADER]);
        const relayToken = this.readHeaderValue(request.headers[TEAM_CLUSTER_BINARY_RELAY_TOKEN_HEADER]);
        const relayProtocolVersion = this.readHeaderValue(request.headers[TEAM_CLUSTER_BINARY_RELAY_PROTOCOL_HEADER]);

        try {
            return this.binaryRelayService.authorizeUpgrade({
                relaySessionId,
                relayToken,
                relayProtocolVersion
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to authorize binary relay upgrade');
        }
    }

    private readHeaderValue(value: string | string[] | undefined): string | undefined {
        if (Array.isArray(value)) {
            return value[0];
        }

        return typeof value === 'string' && value.trim().length > 0
            ? value.trim()
            : undefined;
    }
}
