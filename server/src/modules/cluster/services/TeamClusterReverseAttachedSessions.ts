import {
    clearPendingTimeout,
    unwrapEnvelopeBuffer,
    wrapEnvelopeBuffer
} from '@modules/cluster/services/reverse-channel-protocol';
import {
    createBufferedStream,
    SESSION_ATTACH_TIMEOUT_MS,
    type PendingTerminalEntry,
    type PendingWebSocketEntry
} from '@modules/cluster/services/reverse-channel-pending';
import type ReverseChannelPendingEntries from '@modules/cluster/services/reverse-channel-pending';
import {
    TeamClusterReverseTerminalExec,
    TeamClusterReverseTerminalStream
} from '@modules/cluster/services/TeamClusterReverseTerminal';
import { TeamClusterReverseWebSocketStream } from '@modules/cluster/services/TeamClusterReverseWebSocket';
import {
    TeamClusterDaemonSessionKind,
    type TeamClusterDaemonMessage,
    type TeamClusterDaemonSessionAttachPayload,
    type TeamClusterDaemonSessionAttachResult,
    type TeamClusterDaemonSessionDataPayload,
    type TeamClusterDaemonSessionEndPayload,
    type TeamClusterDaemonSocketResponsePayload
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
import type { ContainerTerminalAttachment, ContainerTerminalSize } from '@shared/contracts/ports';
import { randomUUID } from 'node:crypto';

type AttachedSessionEntry = PendingTerminalEntry | PendingWebSocketEntry;

interface TeamClusterReverseAttachedSessionsOptions {
    pending: ReverseChannelPendingEntries;
    requireSocketId: (teamClusterId: string) => Promise<string>;
    emitToDaemon: (socketId: string, payload: TeamClusterDaemonMessage) => void;
    emitCommand: (socketId: string, requestId: string, command: string, payload: unknown) => void;
}

/**
 * The two long-lived attached sessions the daemon proxies for us: a container
 * terminal and an outbound websocket. Both are opened with an attach command and
 * then exchange framed chunks until either side ends them.
 */
export default class TeamClusterReverseAttachedSessions {
    readonly #pending: ReverseChannelPendingEntries;
    readonly #requireSocketId: TeamClusterReverseAttachedSessionsOptions['requireSocketId'];
    readonly #emitToDaemon: TeamClusterReverseAttachedSessionsOptions['emitToDaemon'];
    readonly #emitCommand: TeamClusterReverseAttachedSessionsOptions['emitCommand'];

    constructor(options: TeamClusterReverseAttachedSessionsOptions) {
        this.#pending = options.pending;
        this.#requireSocketId = options.requireSocketId;
        this.#emitToDaemon = options.emitToDaemon;
        this.#emitCommand = options.emitCommand;
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        const socketId = await this.#requireSocketId(teamClusterId);
        const sessionId = randomUUID();
        const stream = createBufferedStream();

        return this.#pending.create({
            correlationId: sessionId,
            entryType: 'terminal',
            timeoutMs: SESSION_ATTACH_TIMEOUT_MS,
            timeoutMessage: 'Timed out waiting for daemon terminal attachment',
            createEntry: (resolve, reject, timeout) => ({
                type: 'terminal',
                socketId,
                timeout,
                stream,
                resolve,
                reject
            }),
            emitMessage: () => {
                this.#emitAttach(socketId, sessionId, {
                    sessionId,
                    kind: TeamClusterDaemonSessionKind.Terminal,
                    containerId
                });
            }
        });
    }

    async attachWebSocket(
        teamClusterId: string,
        targetUrl: string,
        protocols?: string[]
    ): Promise<TeamClusterReverseWebSocketStream> {
        const socketId = await this.#requireSocketId(teamClusterId);
        const sessionId = randomUUID();
        const stream = new TeamClusterReverseWebSocketStream((message) => {
            this.#emitInput(socketId, sessionId, message.data, message.isBinary);
        }, () => {
            this.detach(sessionId);
        });

        return this.#pending.create({
            correlationId: sessionId,
            entryType: 'websocket',
            timeoutMs: SESSION_ATTACH_TIMEOUT_MS,
            timeoutMessage: 'Timed out waiting for daemon websocket attachment',
            createEntry: (resolve, reject, timeout) => ({
                type: 'websocket',
                socketId,
                timeout,
                stream,
                resolve,
                reject
            }),
            emitMessage: () => {
                this.#emitAttach(socketId, sessionId, {
                    sessionId,
                    kind: TeamClusterDaemonSessionKind.WebSocket,
                    targetUrl,
                    ...(protocols?.length ? { protocols } : {})
                });
            }
        });
    }

    handleAttachResponse(payload: TeamClusterDaemonSocketResponsePayload, entry: AttachedSessionEntry): void {
        if (!entry.timeout) {
            return;
        }

        if (!payload.ok) {
            this.#pending.reject(
                payload.requestId,
                entry,
                new Error(payload.message || 'Daemon session attach failed')
            );
            return;
        }

        clearPendingTimeout(entry.timeout);
        entry.timeout = null;
        this.#pending.touch(payload.requestId);

        if (entry.type === 'terminal') {
            entry.resolve(this.#createTerminalAttachment(entry, payload.requestId));
            return;
        }

        const attachResult = payload.data?.data as TeamClusterDaemonSessionAttachResult | undefined;
        entry.stream.protocol = attachResult?.selectedProtocol;
        entry.resolve(entry.stream);
    }

    handleData(payload: TeamClusterDaemonSessionDataPayload): void {
        const entry = this.#entryFor(payload.sessionId);
        if (!entry) {
            return;
        }

        this.#pending.touch(payload.sessionId);
        const chunk = unwrapEnvelopeBuffer(payload.chunk);

        if (entry.type === 'terminal') {
            entry.stream.write(chunk);
            return;
        }

        entry.stream.emitData({
            data: chunk,
            isBinary: payload.isBinary
        });
    }

    handleEnd(payload: TeamClusterDaemonSessionEndPayload): void {
        const entry = this.#entryFor(payload.sessionId);
        if (!entry) {
            return;
        }

        const error = payload.error ? new Error(payload.error) : undefined;

        if (entry.timeout) {
            this.#pending.reject(
                payload.sessionId,
                entry,
                error || new Error(payload.message || `Daemon ${entry.type} session ended before attachment completed`)
            );
            return;
        }

        if (entry.type === 'terminal') {
            if (error) {
                entry.stream.emit('error', error);
            }
            entry.stream.end();
        } else if (error) {
            entry.stream.emitError(error);
        } else {
            entry.stream.emitEnd({
                code: payload.code,
                message: payload.message
            });
        }

        this.#pending.delete(payload.sessionId);
    }

    detach(sessionId: string): void {
        const entry = this.#entryFor(sessionId);
        if (!entry) {
            return;
        }

        this.#emitToDaemon(entry.socketId, {
            type: 'session-detach',
            sessionId
        });

        if (entry.type === 'terminal') {
            entry.stream.destroy();
        }
        this.#pending.delete(sessionId);
    }

    #entryFor(sessionId: string): AttachedSessionEntry | null {
        const entry = this.#pending.get(sessionId);
        return entry?.type === 'terminal' || entry?.type === 'websocket' ? entry : null;
    }

    #createTerminalAttachment(entry: PendingTerminalEntry, sessionId: string): ContainerTerminalAttachment {
        return {
            exec: new TeamClusterReverseTerminalExec((size) => {
                this.#emitResize(entry.socketId, sessionId, size);
            }),
            stream: new TeamClusterReverseTerminalStream(entry.stream, (input) => {
                this.#emitInput(entry.socketId, sessionId, Buffer.from(input, 'utf8'), false);
            }, () => {
                this.detach(sessionId);
            }),
            close: async () => {
                this.detach(sessionId);
            }
        };
    }

    /** The attach request correlates on the session id, so it doubles as the request id. */
    #emitAttach(socketId: string, sessionId: string, payload: TeamClusterDaemonSessionAttachPayload): void {
        this.#emitCommand(socketId, sessionId, 'session.attach', payload);
    }

    #emitInput(socketId: string, sessionId: string, chunk: Buffer, isBinary: boolean): void {
        this.#emitToDaemon(socketId, {
            type: 'session-input',
            sessionId,
            chunk: wrapEnvelopeBuffer(chunk),
            isBinary
        });
    }

    #emitResize(socketId: string, sessionId: string, size: ContainerTerminalSize): void {
        this.#emitToDaemon(socketId, {
            type: 'session-resize',
            sessionId,
            rows: size.rows,
            cols: size.cols
        });
    }
}
