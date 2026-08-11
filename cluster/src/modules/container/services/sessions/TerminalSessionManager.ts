import { errorMessage } from '@shared/application/utilities/error-message';
import { logger } from '@shared/infrastructure/logger';
import { DockerRuntime } from '@shared/infrastructure/runtime/DockerRuntime';
import { withTimeout } from '@shared/infrastructure/observability/daemon-instrumentation';
import { SESSION_ATTACH_TIMEOUT_MS } from '@core/constants/reverse-channel';
import { decodeStreamChunk, encodeStreamChunk } from '@shared/contracts/channel/binary-envelope';
import { createSessionAttachFailureResult, failSessionAttach } from '@modules/container/services/sessions/session-transitions';
import type { RuntimeTerminalAttachment } from '@shared/infrastructure/runtime/DockerRuntime';
import type { TeamClusterDaemonSessionAttachPayload, TeamClusterDaemonSessionResizePayload } from '@shared/contracts';
import type { BinarySessionInputPayload } from '@shared/contracts/channel/binary-messages';
import type { SessionCommandResult, SessionTransitionCoordinator } from '@modules/container/services/sessions/session-transitions';

interface ReverseChannelTerminalState {
    attachment: RuntimeTerminalAttachment;
    onData: (chunk: Buffer) => void;
    onEnd: () => void;
    onError: (error: Error) => void;
};

interface TerminalSessionManagerOptions {
    dockerRuntime: DockerRuntime;
    coordinator: SessionTransitionCoordinator;
};

export class TerminalSessionManager {
    readonly terminalStates = new Map<string, ReverseChannelTerminalState>();

    constructor(private readonly options: TerminalSessionManagerOptions) {}

    async attachSession(payload: TeamClusterDaemonSessionAttachPayload): Promise<SessionCommandResult> {
        const sessionTransition = this.options.coordinator.beginSessionTransition(payload.sessionId);
        if (!sessionTransition) {
            return failSessionAttach(this.options.coordinator, payload.sessionId, 409, 'Session attach is already in progress');
        }

        try {
            let attachment: RuntimeTerminalAttachment;

            this.options.coordinator.cleanupInteractiveSession(payload.sessionId);
            const containerId = payload.containerId;
            if (!containerId) {
                return failSessionAttach(this.options.coordinator, payload.sessionId, 400, 'containerId is required for container terminal');
            }

            attachment = await withTimeout(
                () => this.options.dockerRuntime.attachTerminal(containerId),
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
                return createSessionAttachFailureResult(409, 'Session attach was cancelled before terminal was established');
            }

            const onData = (chunk: Buffer) => {
                this.options.coordinator.touchSession(payload.sessionId);
                this.options.coordinator.emitMessage({
                    type: 'session-data',
                    sessionId: payload.sessionId,
                    chunk: encodeStreamChunk(chunk),
                    isBinary: false
                });
            };
            const onEnd = () => {
                this.endSession(payload.sessionId);
            };
            const onError = (error: Error) => {
                this.endSession(payload.sessionId, error.message);
            };

            attachment.stream.on('data', onData);
            attachment.stream.on('end', onEnd);
            attachment.stream.on('error', onError);

            this.terminalStates.set(payload.sessionId, {
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
            return failSessionAttach(this.options.coordinator, payload.sessionId, 500, message);
        } finally {
            this.options.coordinator.endSessionTransition(sessionTransition);
        }
    }

    handleInput(payload: BinarySessionInputPayload): boolean {
        const terminalState = this.terminalStates.get(payload.sessionId);
        if (!terminalState) {
            return false;
        }

        try {
            const chunk = decodeStreamChunk(payload.chunk);
            this.options.coordinator.touchSession(payload.sessionId);
            terminalState.attachment.stream.write(chunk);
            return true;
        } catch (error) {
            this.endSession(
                payload.sessionId,
                `Malformed terminal input envelope: ${errorMessage(error)}`
            );
            return true;
        }
    }

    handleResize(payload: TeamClusterDaemonSessionResizePayload): boolean {
        const terminalState = this.terminalStates.get(payload.sessionId);
        if (!terminalState) {
            return false;
        }

        this.options.coordinator.touchSession(payload.sessionId);
        terminalState.attachment.exec.resize({
            rows: payload.rows,
            cols: payload.cols
        }).catch((error) => {
            logger.warn(`Failed to resize terminal session ${payload.sessionId}: ${errorMessage(error)}`);
        });
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

    private endSession(sessionId: string, error?: string): void {
        this.options.coordinator.emitMessage({
            type: 'session-end',
            sessionId,
            ...(error !== undefined ? { error } : {})
        });
        this.cleanupSession(sessionId);
    }
}
