import {
    clearPendingTimeout,
    unwrapEnvelopeBuffer,
    wrapEnvelopeBuffer
} from '@modules/cluster/services/reverse-channel/reverse-channel-protocol';
import {
    SESSION_ATTACH_TIMEOUT_MS,
    type PendingWebSocketEntry
} from '@modules/cluster/services/reverse-channel/reverse-channel-pending';
import type ReverseChannelPendingEntries from '@modules/cluster/services/reverse-channel/reverse-channel-pending';
import { TeamClusterReverseWebSocketStream } from '@modules/cluster/services/reverse-channel/TeamClusterReverseWebSocket';
import {
    TeamClusterDaemonSessionKind,
    type TeamClusterDaemonMessage,
    type TeamClusterDaemonSessionAttachPayload,
    type TeamClusterDaemonSessionAttachResult,
    type TeamClusterDaemonSessionDataPayload,
    type TeamClusterDaemonSessionEndPayload,
    type TeamClusterDaemonSocketResponsePayload
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
import { randomUUID } from 'node:crypto';

type AttachedSessionEntry = PendingWebSocketEntry;

interface TeamClusterReverseAttachedSessionsOptions {
    pending: ReverseChannelPendingEntries;
    requireSocketId: (teamClusterId: string) => Promise<string>;
    emitToDaemon: (socketId: string, payload: TeamClusterDaemonMessage) => void;
    emitCommand: (socketId: string, requestId: string, command: string, payload: unknown) => void;
}

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

        if (error) {
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
        this.#pending.delete(sessionId);
    }

    #entryFor(sessionId: string): AttachedSessionEntry | null {
        const entry = this.#pending.get(sessionId);
        return entry?.type === 'websocket' ? entry : null;
    }

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
}
