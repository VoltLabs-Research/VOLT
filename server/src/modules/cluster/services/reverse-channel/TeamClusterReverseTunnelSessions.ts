import {
    clearPendingTimeout,
    createTunnelOpenPayload,
    resolveTunnelChannel,
    unwrapEnvelopeBuffer,
    wrapEnvelopeBuffer,
    type TeamClusterTunnelOpenOptions,
    type TeamClusterTunnelOpenRequest
} from '@modules/cluster/services/reverse-channel/reverse-channel-protocol';
import {
    failPendingTunnelWrites,
    SESSION_ATTACH_TIMEOUT_MS,
    TUNNEL_DRAIN_TIMEOUT_MS,
    TUNNEL_FLOW_CONTROL_LOW_WATER_BYTES,
    TUNNEL_FLOW_CONTROL_WINDOW_BYTES,
    type PendingTunnelEntry
} from '@modules/cluster/services/reverse-channel/reverse-channel-pending';
import type ReverseChannelPendingEntries from '@modules/cluster/services/reverse-channel/reverse-channel-pending';
import { TeamClusterReverseTunnelStream } from '@modules/cluster/services/reverse-channel/TeamClusterReverseTunnelStream';
import {
    TeamClusterTunnelSessionStatus,
    type TeamClusterDaemonMessage,
    type TeamClusterDaemonSocketChannel,
    type TeamClusterDaemonTunnelClosePayload,
    type TeamClusterDaemonTunnelDataPayload,
    type TeamClusterDaemonTunnelDrainPayload,
    type TeamClusterDaemonTunnelStatePayload
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
import logger from '@shared/infrastructure/logger';
import { randomUUID } from 'node:crypto';

interface TeamClusterReverseTunnelSessionsOptions {
    pending: ReverseChannelPendingEntries;
    requireSocketId: (teamClusterId: string, channel: TeamClusterDaemonSocketChannel) => Promise<string>;
    emitToDaemon: (socketId: string, payload: TeamClusterDaemonMessage) => void;
}

export default class TeamClusterReverseTunnelSessions {
    readonly #pending: ReverseChannelPendingEntries;
    readonly #requireSocketId: TeamClusterReverseTunnelSessionsOptions['requireSocketId'];
    readonly #emitToDaemon: TeamClusterReverseTunnelSessionsOptions['emitToDaemon'];

    constructor(options: TeamClusterReverseTunnelSessionsOptions) {
        this.#pending = options.pending;
        this.#requireSocketId = options.requireSocketId;
        this.#emitToDaemon = options.emitToDaemon;
    }

    async open(
        teamClusterId: string,
        request: TeamClusterTunnelOpenRequest,
        options?: TeamClusterTunnelOpenOptions
    ): Promise<TeamClusterReverseTunnelStream> {
        const socketId = await this.#requireSocketId(teamClusterId, resolveTunnelChannel(request));
        const sessionId = randomUUID();
        const openPayload = createTunnelOpenPayload(sessionId, request);

        const stream = new TeamClusterReverseTunnelStream({
            onWrite: (chunk, callback) => {
                this.#emitData(socketId, sessionId, chunk.data, chunk.isBinary, callback);
            },
            onClose: () => {
                this.close(sessionId);
            }
        });

        return this.#pending.create({
            correlationId: sessionId,
            entryType: 'tunnel',
            timeoutMs: options?.timeoutMs ?? SESSION_ATTACH_TIMEOUT_MS,
            timeoutMessage: options?.timeoutMessage ?? 'Timed out waiting for daemon tunnel attachment',
            createEntry: (resolve, reject, timeout) => ({
                type: 'tunnel',
                socketId,
                timeout,
                stream,
                resolve,
                reject,
                nextWriteSequence: 0,
                pendingWriteAcks: new Map(),
                pendingWriteBytes: 0
            }),
            emitMessage: () => {
                this.#emitToDaemon(socketId, openPayload);
            }
        });
    }

    handleState(payload: TeamClusterDaemonTunnelStatePayload): void {
        const entry = this.#entryFor(payload.sessionId);
        if (!entry || payload.status === TeamClusterTunnelSessionStatus.Opening) {
            return;
        }

        const error = payload.error ? new Error(payload.error) : undefined;

        if (entry.timeout) {
            clearPendingTimeout(entry.timeout);
            entry.timeout = null;

            if (payload.status !== TeamClusterTunnelSessionStatus.Open || error) {
                const openError = error || new Error(payload.message || 'Failed to open daemon tunnel');
                failPendingTunnelWrites(entry, openError);
                this.#pending.delete(payload.sessionId);
                entry.reject(openError);
                return;
            }

            entry.resolve(entry.stream);
            this.#pending.touch(payload.sessionId);
            return;
        }

        if (error) {
            failPendingTunnelWrites(entry, error);
            entry.stream.fail(error);
        } else if (payload.status === TeamClusterTunnelSessionStatus.Closed) {
            failPendingTunnelWrites(entry, new Error(payload.message || 'Tunnel session closed'));
            entry.stream.closeRemote();
        }

        this.#pending.delete(payload.sessionId);
    }

    handleData(payload: TeamClusterDaemonTunnelDataPayload): void {
        const entry = this.#entryFor(payload.sessionId);
        if (!entry) {
            return;
        }

        this.#pending.touch(payload.sessionId);

        let chunk: Buffer;
        try {
            chunk = unwrapEnvelopeBuffer(payload.chunk);
        } catch (error: unknown) {
            const decodeError = error instanceof Error ? error : new Error(String(error));
            logger.warn(`[ReverseChannel] tunnel-data decode failed sessionId=${payload.sessionId} bytes=${payload.chunk.byteLength} error=${decodeError.message}`);
            failPendingTunnelWrites(entry, decodeError);
            entry.stream.fail(decodeError);
            this.#pending.delete(payload.sessionId);
            return;
        }

        const sequence = payload.sequence;
        if (payload.requiresAck && sequence !== undefined) {
            entry.stream.pushChunk(chunk, () => {
                this.#emitDrain(entry.socketId, payload.sessionId, sequence);
            });
            return;
        }

        entry.stream.pushChunk(chunk);
    }

    handleDrain(payload: TeamClusterDaemonTunnelDrainPayload): void {
        const entry = this.#entryFor(payload.sessionId);
        const pendingAck = entry?.pendingWriteAcks.get(payload.sequence);
        if (!entry || !pendingAck) {
            return;
        }

        this.#pending.touch(payload.sessionId);
        clearTimeout(pendingAck.timeout);
        entry.pendingWriteAcks.delete(payload.sequence);
        entry.pendingWriteBytes = Math.max(0, entry.pendingWriteBytes - pendingAck.bytes);

        if (entry.blockedWriteCallback && entry.pendingWriteBytes <= TUNNEL_FLOW_CONTROL_LOW_WATER_BYTES) {
            const callback = entry.blockedWriteCallback;
            entry.blockedWriteCallback = undefined;
            callback();
        }
    }

    handleClose(payload: TeamClusterDaemonTunnelClosePayload): void {
        const entry = this.#entryFor(payload.sessionId);
        if (!entry) {
            return;
        }

        failPendingTunnelWrites(entry, new Error(payload.message || 'Tunnel session closed'));
        entry.stream.closeRemote();
        this.#pending.delete(payload.sessionId);
    }

    close(sessionId: string): void {
        const entry = this.#entryFor(sessionId);
        if (!entry) {
            return;
        }

        this.#emitToDaemon(entry.socketId, {
            type: 'tunnel-close',
            sessionId
        });
        failPendingTunnelWrites(entry, new Error('Tunnel session closed'));
        this.#pending.delete(sessionId);
    }

    #entryFor(sessionId: string): PendingTunnelEntry | null {
        const entry = this.#pending.get(sessionId);
        return entry?.type === 'tunnel' ? entry : null;
    }

    #emitData(
        socketId: string,
        sessionId: string,
        chunk: Buffer,
        isBinary: boolean,
        callback: (error?: Error | null) => void
    ): void {
        const entry = this.#entryFor(sessionId);
        if (!entry) {
            callback(new Error('Tunnel session is not open'));
            return;
        }

        const sequence = ++entry.nextWriteSequence;
        const timeout = setTimeout(() => {
            const activeEntry = this.#entryFor(sessionId);
            const pendingAck = activeEntry?.pendingWriteAcks.get(sequence);
            if (!activeEntry || !pendingAck) {
                return;
            }

            activeEntry.pendingWriteAcks.delete(sequence);
            activeEntry.pendingWriteBytes = Math.max(0, activeEntry.pendingWriteBytes - pendingAck.bytes);
            const error = new Error(`Timed out waiting for tunnel drain acknowledgement after ${TUNNEL_DRAIN_TIMEOUT_MS}ms`);
            failPendingTunnelWrites(activeEntry, error);
            activeEntry.stream.fail(error);
            this.close(sessionId);
        }, TUNNEL_DRAIN_TIMEOUT_MS);
        timeout.unref();

        entry.pendingWriteAcks.set(sequence, {
            bytes: chunk.byteLength,
            timeout
        });
        entry.pendingWriteBytes += chunk.byteLength;

        this.#emitToDaemon(socketId, {
            type: 'tunnel-data',
            sessionId,
            chunk: wrapEnvelopeBuffer(chunk),
            isBinary,
            sequence,
            requiresAck: true
        });

        if (entry.pendingWriteBytes <= TUNNEL_FLOW_CONTROL_WINDOW_BYTES) {
            callback();
            return;
        }

        entry.blockedWriteCallback = callback;
    }

    #emitDrain(socketId: string, sessionId: string, sequence: number): void {
        this.#emitToDaemon(socketId, {
            type: 'tunnel-drain',
            sessionId,
            sequence
        });
    }
}
