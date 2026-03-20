import { DockerRuntimeService, HostShellService } from '@/modules/platform/services';
import { withTimeout } from '@/shared/observability/daemonInstrumentation';
import { REVERSE_CHANNEL } from '@/shared/contracts';
import { BASE64_SESSION_CHUNK_PATTERN, SESSION_ATTACH_TIMEOUT_MS } from './reverseChannelSessionConstants';
import type { RuntimeTerminalAttachment } from '@/modules/platform/services';
import type {
    TeamClusterDaemonSessionAttachPayload,
    TeamClusterDaemonSessionDataPayload,
    TeamClusterDaemonSessionEndPayload,
    TeamClusterDaemonSessionInputPayload,
    TeamClusterDaemonSessionResizePayload
} from '@/shared/contracts';
import type { CommandResult } from '@voltstack/daemon-cluster-client';

interface ReverseChannelTerminalState {
    sessionId: string;
    attachment: RuntimeTerminalAttachment;
    onData: (chunk: Buffer) => void;
    onEnd: () => void;
    onError: (error: Error) => void;
};

interface SessionTransition {
    sessionId: string;
    transitionId: number;
};

interface TerminalSessionManagerOptions {
    dockerRuntimeService?: DockerRuntimeService;
    hostShellService?: HostShellService;
    coordinator: TerminalSessionManagerCoordinator;
};

interface TerminalSessionManagerCoordinator {
    beginSessionTransition(sessionId: string): SessionTransition | null;
    cleanupInteractiveSession(sessionId: string): void;
    clearSessionActivityIfUntracked(sessionId: string): void;
    emitSessionData(payload: TeamClusterDaemonSessionDataPayload): void;
    emitSessionEnd(payload: TeamClusterDaemonSessionEndPayload): void;
    endSessionTransition(transition: SessionTransition): void;
    touchSession(sessionId: string): void;
    wasSessionTransitionCancelled(transition: SessionTransition): boolean;
};

export class TerminalSessionManager {
    private readonly terminalStates = new Map<string, ReverseChannelTerminalState>();

    constructor(private readonly options: TerminalSessionManagerOptions) {}

    hasSession(sessionId: string): boolean {
        return this.terminalStates.has(sessionId);
    }

    getSessionIds(): string[] {
        return Array.from(this.terminalStates.keys());
    }

    async attachSession(payload: TeamClusterDaemonSessionAttachPayload): Promise<CommandResult> {
        const needsHostTerminal = payload.terminalTarget === REVERSE_CHANNEL.TerminalTarget.Host;
        const needsContainerTerminal = !needsHostTerminal;

        if (
            (needsHostTerminal && !this.options.hostShellService)
            || (needsContainerTerminal && !this.options.dockerRuntimeService)
        ) {
            const message = 'Terminal services are not available';
            this.options.coordinator.emitSessionEnd({
                type: 'session-end',
                sessionId: payload.sessionId,
                error: message
            });
            return this.createSessionAttachFailureResult(503, message);
        }

        const sessionTransition = this.options.coordinator.beginSessionTransition(payload.sessionId);
        if (!sessionTransition) {
            const message = 'Session attach is already in progress';
            this.options.coordinator.emitSessionEnd({
                type: 'session-end',
                sessionId: payload.sessionId,
                error: message
            });
            return this.createSessionAttachFailureResult(409, message);
        }

        try {
            let attachment: RuntimeTerminalAttachment;

            this.options.coordinator.cleanupInteractiveSession(payload.sessionId);

            if (payload.terminalTarget === REVERSE_CHANNEL.TerminalTarget.Host) {
                const hostShellService = this.options.hostShellService;
                if (!hostShellService) {
                    return this.createSessionAttachFailureResult(503, 'Terminal services are not available');
                }

                attachment = await withTimeout(
                    () => hostShellService.attachTerminal(),
                    {
                        operation: 'reverse-channel.host-terminal.attach',
                        timeoutMs: SESSION_ATTACH_TIMEOUT_MS,
                        payload: { sessionId: payload.sessionId }
                    }
                );
            } else {
                const containerId = payload.containerId;
                if (!containerId) {
                    const message = 'containerId is required for container terminal';
                    this.options.coordinator.emitSessionEnd({
                        type: 'session-end',
                        sessionId: payload.sessionId,
                        error: message
                    });
                    return this.createSessionAttachFailureResult(400, message);
                }

                const dockerRuntimeService = this.options.dockerRuntimeService;
                if (!dockerRuntimeService) {
                    return this.createSessionAttachFailureResult(503, 'Terminal services are not available');
                }

                attachment = await withTimeout(
                    () => dockerRuntimeService.attachTerminal(containerId),
                    {
                        operation: 'reverse-channel.container-terminal.attach',
                        timeoutMs: SESSION_ATTACH_TIMEOUT_MS,
                        payload: {
                            containerId,
                            sessionId: payload.sessionId
                        }
                    }
                );
            }

            if (this.options.coordinator.wasSessionTransitionCancelled(sessionTransition)) {
                attachment.stream.destroy();
                return this.createSessionAttachFailureResult(
                    409,
                    'Session attach was cancelled before terminal was established'
                );
            }

            const onData = (chunk: Buffer) => {
                this.options.coordinator.touchSession(payload.sessionId);
                this.options.coordinator.emitSessionData({
                    type: 'session-data',
                    sessionId: payload.sessionId,
                    chunkBase64: chunk.toString('base64'),
                    isBinary: false
                });
            };
            const onEnd = () => {
                this.options.coordinator.emitSessionEnd({
                    type: 'session-end',
                    sessionId: payload.sessionId
                });
                this.cleanupSession(payload.sessionId);
            };
            const onError = (error: Error) => {
                this.options.coordinator.emitSessionEnd({
                    type: 'session-end',
                    sessionId: payload.sessionId,
                    error: error.message
                });
                this.cleanupSession(payload.sessionId);
            };

            attachment.stream.on('data', onData);
            attachment.stream.on('end', onEnd);
            attachment.stream.on('error', onError);

            this.terminalStates.set(payload.sessionId, {
                sessionId: payload.sessionId,
                attachment,
                onData,
                onEnd,
                onError
            });
            this.options.coordinator.touchSession(payload.sessionId);

            return this.createSessionAttachSuccessResult();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to attach terminal';
            this.options.coordinator.emitSessionEnd({
                type: 'session-end',
                sessionId: payload.sessionId,
                error: message
            });
            return this.createSessionAttachFailureResult(500, message);
        } finally {
            this.options.coordinator.endSessionTransition(sessionTransition);
        }
    }

    handleInput(payload: TeamClusterDaemonSessionInputPayload): boolean {
        const terminalState = this.terminalStates.get(payload.sessionId);
        if (!terminalState) {
            return false;
        }

        if (!BASE64_SESSION_CHUNK_PATTERN.test(payload.chunkBase64)) {
            this.options.coordinator.emitSessionEnd({
                type: 'session-end',
                sessionId: payload.sessionId,
                error: 'Session input is not valid base64 data'
            });
            this.cleanupSession(payload.sessionId);
            return true;
        }

        const chunk = Buffer.from(payload.chunkBase64, 'base64');

        this.options.coordinator.touchSession(payload.sessionId);
        terminalState.attachment.stream.write(chunk);
        return true;
    }

    handleResize(payload: TeamClusterDaemonSessionResizePayload): boolean {
        const terminalState = this.terminalStates.get(payload.sessionId);
        if (!terminalState) {
            return false;
        }

        this.options.coordinator.touchSession(payload.sessionId);
        terminalState.attachment.exec.resize({ rows: payload.rows, cols: payload.cols }).catch(() => {});
        return true;
    }

    cleanupSession(sessionId: string): void {
        const terminalState = this.terminalStates.get(sessionId);
        if (!terminalState) {
            this.options.coordinator.clearSessionActivityIfUntracked(sessionId);
            return;
        }

        terminalState.attachment.stream.removeListener('data', terminalState.onData);
        terminalState.attachment.stream.removeListener('end', terminalState.onEnd);
        terminalState.attachment.stream.removeListener('error', terminalState.onError);
        terminalState.attachment.stream.destroy();
        this.terminalStates.delete(sessionId);
        this.options.coordinator.clearSessionActivityIfUntracked(sessionId);
    }

    private createSessionAttachSuccessResult(): CommandResult {
        return { status: 200, data: { status: 'success', data: { attached: true } } };
    }

    private createSessionAttachFailureResult(status: number, message: string): CommandResult {
        return {
            status,
            data: {
                status: 'error',
                message
            }
        };
    }
}
