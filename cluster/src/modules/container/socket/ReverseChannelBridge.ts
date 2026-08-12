import { singleton } from '@shared/application/utilities/singleton';
import { getDaemonExposureRegistry } from '@modules/container/services/access/DaemonExposureRegistry';
import { TTLCache } from '@isaacs/ttlcache';
import { DockerRuntime, getDockerRuntime } from '@shared/infrastructure/runtime/DockerRuntime';
import { logger } from '@shared/infrastructure/logger';
import { REVERSE_CHANNEL } from '@core/constants/reverse-channel';
import { TerminalSessionManager } from '@modules/container/services/sessions/TerminalSessionManager';
import { WebSocketSessionManager } from '@modules/container/services/sessions/WebSocketSessionManager';
import { TunnelSessionManager, type TunnelMessageTransport } from '@modules/container/services/sessions/TunnelSessionManager';
import { createReverseChannelCommandHandler } from '@modules/container/socket/reverse-channel-command-handler';
import type { TeamClusterDaemonSessionAttachPayload } from '@voltstack/daemon-cluster-client';
import type {
    BinarySessionInputPayload,
    ReverseChannelInboundMessage,
    ReverseChannelOutboundMessage
} from '@shared/contracts/channel/binary-messages';
import type {
    ReverseChannelCommandResult,
    ReverseChannelCommandExecutor
} from '@shared/contracts/channel/reverse-channel-messaging';
import type { SessionTransition } from '@modules/container/services/sessions/session-transitions';
import type { DaemonExposureRegistry } from '@modules/container/services/access/DaemonExposureRegistry';
import type { VoltCloudConnection } from '@modules/container/socket/connection/VoltCloudConnection';

interface RegisteredReverseChannelCommand {
    commandName: string;
    execute: ReverseChannelCommandExecutor;
}

interface ReverseChannelInboundTransport extends TunnelMessageTransport {
    onMessage(listener: (message: ReverseChannelInboundMessage) => void): void;
    onDisconnected?(listener: () => void): void;
}

const SESSION_IDLE_TTL_MS = 10 * 60 * 1000;

export class ReverseChannelBridge {
    private readonly tunnelSessionManager: TunnelSessionManager;
    private readonly terminalSessionManager: TerminalSessionManager;
    private readonly webSocketSessionManager: WebSocketSessionManager;
    private readonly attachingSessionIds = new Map<string, number>();
    private readonly cancelledSessionTransitions = new Set<number>();
    private nextSessionTransitionId = 0;

    private readonly sessionActivity = new TTLCache<string, true>({
        ttl: SESSION_IDLE_TTL_MS,
        updateAgeOnGet: true,
        checkAgeOnGet: true,
        checkAgeOnHas: true,
        dispose: (_value, sessionId, reason) => {
            if (reason !== 'stale') {
                return;
            }

            logger.warn(`Session idle TTL expired — cleaning up sessionId=${sessionId}`);
            this.cleanupInteractiveSession(sessionId);
        }
    });

    private readonly pendingCommands: RegisteredReverseChannelCommand[] = [];
    private voltCloudConnection: VoltCloudConnection | null = null;

    constructor(
        dockerRuntime: DockerRuntime,
        daemonExposureRegistry: DaemonExposureRegistry
    ) {
        const coordinator = {
            beginSessionTransition: this.beginSessionTransition.bind(this),
            endSessionTransition: this.endSessionTransition.bind(this),
            wasSessionTransitionCancelled: (transition: SessionTransition) =>
                this.cancelledSessionTransitions.has(transition.transitionId),
            cleanupInteractiveSession: this.cleanupInteractiveSession.bind(this),
            touchSession: this.touchSession.bind(this),
            forgetSessionActivity: (sessionId: string) => this.sessionActivity.delete(sessionId),
            clearSessionActivityIfUntracked: this.clearSessionActivityIfUntracked.bind(this),
            emitMessage: this.emitMessage.bind(this)
        };
        this.terminalSessionManager = new TerminalSessionManager({
            dockerRuntime,
            coordinator
        });
        this.webSocketSessionManager = new WebSocketSessionManager({ coordinator });
        this.tunnelSessionManager = new TunnelSessionManager({
            coordinator,
            daemonExposureRegistry
        });

        this.registerCommand('session.attach', (payload) => this.attachSession(payload as TeamClusterDaemonSessionAttachPayload));
    }

    registerCommand(commandName: string, execute: ReverseChannelCommandExecutor): void {
        if (this.voltCloudConnection) {
            this.voltCloudConnection.client.registerHandler(
                commandName,
                createReverseChannelCommandHandler(commandName, execute)
            );
            return;
        }

        this.pendingCommands.push({
            commandName,
            execute
        });
    }

    bindToClient(voltCloudConnection: VoltCloudConnection): void {
        this.voltCloudConnection = voltCloudConnection;

        for (const command of this.pendingCommands) {
            voltCloudConnection.client.registerHandler(
                command.commandName,
                createReverseChannelCommandHandler(command.commandName, command.execute)
            );
        }

        voltCloudConnection.client
            .onMessage((message) => {
                this.routeInboundMessage(message, voltCloudConnection);
            })
            .onDisconnected(() => {
                this.cleanup();
            });
    }

    bindObjectGatewayConnection(connection: ReverseChannelInboundTransport): void {
        connection.onMessage((message) => {
            this.routeInboundMessage(message, connection);
        });
        connection.onDisconnected?.(() => {
            this.tunnelSessionManager.releaseTransport(connection);
        });
    }

    attachSession(payload: TeamClusterDaemonSessionAttachPayload): Promise<ReverseChannelCommandResult> {
        if (payload.kind === REVERSE_CHANNEL.SessionKind.Terminal) {
            return this.terminalSessionManager.attachSession(payload);
        }

        if (payload.kind === REVERSE_CHANNEL.SessionKind.WebSocket) {
            return this.webSocketSessionManager.attachSession(payload);
        }

        return Promise.resolve({
            status: 400,
            data: {
                status: 'error',
                message: `Unsupported session kind: ${payload.kind}`
            }
        });
    }

    cleanup(): void {
        for (const sessionId of this.attachingSessionIds.keys()) {
            this.cancelSessionTransition(sessionId);
        }

        const trackedSessionIds = [
            ...this.terminalSessionManager.terminalStates.keys(),
            ...this.webSocketSessionManager.webSocketStates.keys(),
            ...this.tunnelSessionManager.tunnelStates.keys()
        ];
        for (const sessionId of trackedSessionIds) {
            this.cleanupInteractiveSession(sessionId);
        }

        this.sessionActivity.clear();
    }

    private routeInboundMessage(
        message: ReverseChannelInboundMessage,
        transport: TunnelMessageTransport
    ): void {
        switch (message.type) {
            case 'tunnel-open':
                this.tunnelSessionManager.handleOpen(message, transport);
                return;
            case 'tunnel-data':
                this.tunnelSessionManager.handleData(message);
                return;
            case 'tunnel-drain':
                this.tunnelSessionManager.handleDrain(message);
                return;
            case 'tunnel-close':
                this.tunnelSessionManager.cleanupSession(message.sessionId);
                return;
            case 'session-input':
                this.handleSessionInput(message);
                return;
            case 'session-resize':
                this.terminalSessionManager.handleResize(message);
                return;
            case 'session-detach':
                this.cancelSessionTransition(message.sessionId);
                this.cleanupInteractiveSession(message.sessionId);
                return;
            default:
                return;
        }
    }

    private handleSessionInput(message: BinarySessionInputPayload): void {
        if (this.terminalSessionManager.handleInput(message)) {
            return;
        }

        if (!this.webSocketSessionManager.handleInput(message)) {
            this.sessionActivity.delete(message.sessionId);
        }
    }

    private emitMessage(message: ReverseChannelOutboundMessage): void {
        this.voltCloudConnection?.emitMessage(message);
    }

    private touchSession(sessionId: string): void {
        this.sessionActivity.set(sessionId, true);
    }

    private beginSessionTransition(sessionId: string): SessionTransition | null {
        if (this.attachingSessionIds.has(sessionId)) {
            return null;
        }

        const transitionId = ++this.nextSessionTransitionId;
        this.attachingSessionIds.set(sessionId, transitionId);
        return {
            sessionId,
            transitionId
        };
    }

    private endSessionTransition(transition: SessionTransition): void {
        this.cancelledSessionTransitions.delete(transition.transitionId);

        if (this.attachingSessionIds.get(transition.sessionId) !== transition.transitionId) {
            return;
        }

        this.attachingSessionIds.delete(transition.sessionId);
    }

    private cancelSessionTransition(sessionId: string): void {
        const transitionId = this.attachingSessionIds.get(sessionId);
        if (transitionId === undefined) {
            return;
        }

        this.cancelledSessionTransitions.add(transitionId);
    }

    private clearSessionActivityIfUntracked(sessionId: string): void {
        if (this.terminalSessionManager.terminalStates.has(sessionId)) return;
        if (this.webSocketSessionManager.webSocketStates.has(sessionId)) return;
        if (this.tunnelSessionManager.tunnelStates.has(sessionId)) return;
        this.sessionActivity.delete(sessionId);
    }

    private cleanupInteractiveSession(sessionId: string): void {
        this.terminalSessionManager.cleanupSession(sessionId);
        this.webSocketSessionManager.cleanupSession(sessionId);
        this.tunnelSessionManager.cleanupSession(sessionId);
    }
}

export const getReverseChannelBridge = singleton((): ReverseChannelBridge => new ReverseChannelBridge(getDockerRuntime(), getDaemonExposureRegistry()));
