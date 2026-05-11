import { DockerRuntime } from '@/core/runtime/infrastructure/DockerRuntime';
import { withTimeout } from '@/core/observability/infrastructure/daemon-instrumentation';
import { SESSION_ATTACH_TIMEOUT_MS } from '@/core/reverse-channel/contracts/reverse-channel-constants';
import {
    EnvelopeKind,
    decodeEnvelope,
    encodeEnvelope
} from '@/core/reverse-channel/contracts/binary-envelope';
import type { RuntimeTerminalAttachment } from '@/core/runtime/infrastructure/DockerRuntime';
import type { TeamClusterDaemonSessionAttachPayload, TeamClusterDaemonSessionEndPayload, TeamClusterDaemonSessionResizePayload } from '@/contracts';
import type {
    BinarySessionDataPayload,
    BinarySessionInputPayload
} from '@/core/reverse-channel/contracts/binary-messages';
import type { CommandResult } from '@voltstack/daemon-cluster-client';

type SessionCommandResult = CommandResult<object | null>;

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
    dockerRuntime?: DockerRuntime;
    coordinator: TerminalSessionManagerCoordinator;
};

interface TerminalSessionManagerCoordinator {
    beginSessionTransition(sessionId: string): SessionTransition | null;
    cleanupInteractiveSession(sessionId: string): void;
    clearSessionActivityIfUntracked(sessionId: string): void;
    emitSessionData(payload: BinarySessionDataPayload): void;
    emitSessionEnd(payload: TeamClusterDaemonSessionEndPayload): void;
    endSessionTransition(transition: SessionTransition): void;
    touchSession(sessionId: string): void;
    wasSessionTransitionCancelled(transition: SessionTransition): boolean;
};

export class TerminalSessionManager {
    readonly terminalStates = new Map<string, ReverseChannelTerminalState>();

    constructor(private readonly options: TerminalSessionManagerOptions) {}

    async attachSession(payload: TeamClusterDaemonSessionAttachPayload): Promise<SessionCommandResult> {
        const dockerRuntime = this.options.dockerRuntime;
        if (!dockerRuntime) {
            return this.failAttach(payload.sessionId, 503, 'Terminal services are not available');
        }

        const sessionTransition = this.options.coordinator.beginSessionTransition(payload.sessionId);
        if (!sessionTransition) {
            return this.failAttach(payload.sessionId, 409, 'Session attach is already in progress');
        }

        try {
            let attachment: RuntimeTerminalAttachment;

            this.options.coordinator.cleanupInteractiveSession(payload.sessionId);
            const containerId = payload.containerId;
            if (!containerId) {
                return this.failAttach(payload.sessionId, 400, 'containerId is required for container terminal');
            }

            attachment = await withTimeout(
                () => dockerRuntime.attachTerminal(containerId),
                {
                    operation: 'reverse-channel.container-terminal.attach',
                    timeoutMs: SESSION_ATTACH_TIMEOUT_MS,
                    payload: {
                        containerId,
                        sessionId: payload.sessionId
                    }
                }
            );

            if (this.options.coordinator.wasSessionTransitionCancelled(sessionTransition)) {
                void attachment.close().catch(() => undefined);
                return {
                    status: 409,
                    data: {
                        status: 'error',
                        message: 'Session attach was cancelled before terminal was established'
                    }
                };
            }

            const onData = (chunk: Buffer) => {
                this.options.coordinator.touchSession(payload.sessionId);
                const envelope = encodeEnvelope(
                    0,
                    EnvelopeKind.StreamChunk,
                    chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
                );
                this.options.coordinator.emitSessionData({
                    type: 'session-data',
                    sessionId: payload.sessionId,
                    chunk: envelope,
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

            return {
                status: 200,
                data: { attached: true }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to attach terminal';
            return this.failAttach(payload.sessionId, 500, message);
        } finally {
            this.options.coordinator.endSessionTransition(sessionTransition);
        }
    }

    handleInput(payload: BinarySessionInputPayload): boolean {
        const terminalState = this.terminalStates.get(payload.sessionId);
        if (!terminalState) {
            return false;
        }

        const envelopeBytes = payload.chunk instanceof Uint8Array
            ? payload.chunk
            : new Uint8Array(payload.chunk as unknown as ArrayBufferLike);

        try {
            const decoded = decodeEnvelope(envelopeBytes);
            if (decoded.kind !== EnvelopeKind.StreamChunk) {
                throw new Error(`Unexpected envelope kind: ${decoded.kind}`);
            }
            this.options.coordinator.touchSession(payload.sessionId);
            terminalState.attachment.stream.write(
                Buffer.from(decoded.payload.buffer, decoded.payload.byteOffset, decoded.payload.byteLength)
            );
            return true;
        } catch (error) {
            this.options.coordinator.emitSessionEnd({
                type: 'session-end',
                sessionId: payload.sessionId,
                error: `Malformed terminal input envelope: ${error instanceof Error ? error.message : String(error)}`
            });
            this.cleanupSession(payload.sessionId);
            return true;
        }
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
        this.terminalStates.delete(sessionId);
        this.options.coordinator.clearSessionActivityIfUntracked(sessionId);
        void terminalState.attachment.close().catch(() => undefined);
    }

    private failAttach(sessionId: string, status: number, message: string): SessionCommandResult {
        this.options.coordinator.emitSessionEnd({
            type: 'session-end',
            sessionId,
            error: message
        });
        return {
            status,
            data: {
                status: 'error',
                message
            }
        };
    }
}
