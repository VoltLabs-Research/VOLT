import { clearPendingTimeout } from '@modules/cluster/services/reverse-channel-protocol';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/cluster/services/reverse-channel-protocol';
import type { TeamClusterReverseTunnelStream } from '@modules/cluster/services/TeamClusterReverseTunnelStream';
import type { TeamClusterReverseWebSocketStream } from '@modules/cluster/services/TeamClusterReverseWebSocket';
import type { ContainerTerminalAttachment } from '@shared/contracts/ports';
import type { TeamClusterDaemonSocketResponsePayload } from '@modules/cluster/socket/TeamClusterSocketProtocol';
import logger from '@shared/infrastructure/logger';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import { PassThrough } from 'node:stream';

export const TUNNEL_FLOW_CONTROL_WINDOW_BYTES = readPositiveIntegerEnv(
    'TEAM_CLUSTER_REVERSE_TUNNEL_WINDOW_BYTES',
    8 * 1024 * 1024
);
export const TUNNEL_FLOW_CONTROL_LOW_WATER_BYTES = Math.max(
    64 * 1024,
    Math.floor(TUNNEL_FLOW_CONTROL_WINDOW_BYTES / 2)
);
export const TUNNEL_DRAIN_TIMEOUT_MS = readPositiveIntegerEnv(
    'TEAM_CLUSTER_REVERSE_TUNNEL_DRAIN_TIMEOUT_MS',
    120_000
);
/** Shared by every attach kind: terminal, websocket and tunnel. */
export const SESSION_ATTACH_TIMEOUT_MS = 15_000;

const STREAM_HIGH_WATER_MARK = 256 * 1024;
const SESSION_IDLE_TTL_MS = 10 * 60 * 1000;
const SESSION_SWEEP_INTERVAL_MS = 60 * 1000;

interface BasePendingEntry {
    socketId: string;
    timeout: NodeJS.Timeout | null;
}

export interface PendingResponseEntry extends BasePendingEntry {
    type: 'response';
    resolve: (payload: TeamClusterDaemonSocketResponsePayload) => void;
    reject: (error: Error) => void;
}

export interface PendingStreamEntry extends BasePendingEntry {
    type: 'stream';
    stream: PassThrough;
    resolve: (attachment: TeamClusterReverseChannelStreamAttachment) => void;
    reject: (error: Error) => void;
    streamId?: string;
}

export interface PendingTerminalEntry extends BasePendingEntry {
    type: 'terminal';
    stream: PassThrough;
    resolve: (attachment: ContainerTerminalAttachment) => void;
    reject: (error: Error) => void;
}

export interface PendingWebSocketEntry extends BasePendingEntry {
    type: 'websocket';
    stream: TeamClusterReverseWebSocketStream;
    resolve: (stream: TeamClusterReverseWebSocketStream) => void;
    reject: (error: Error) => void;
}

interface PendingTunnelWriteAck {
    bytes: number;
    timeout: NodeJS.Timeout;
}

export interface PendingTunnelEntry extends BasePendingEntry {
    type: 'tunnel';
    stream: TeamClusterReverseTunnelStream;
    resolve: (stream: TeamClusterReverseTunnelStream) => void;
    reject: (error: Error) => void;
    nextWriteSequence: number;
    pendingWriteAcks: Map<number, PendingTunnelWriteAck>;
    pendingWriteBytes: number;
    blockedWriteCallback?: (error?: Error | null) => void;
}

export type PendingEntry =
    | PendingResponseEntry
    | PendingStreamEntry
    | PendingTerminalEntry
    | PendingWebSocketEntry
    | PendingTunnelEntry;

interface PendingPromiseOptions<TResult, TEntry extends PendingEntry> {
    correlationId: string;
    entryType: PendingEntry['type'];
    timeoutMs: number;
    timeoutMessage: string;
    createEntry: (
        resolve: (value: TResult) => void,
        reject: (error: Error) => void,
        timeout: NodeJS.Timeout | null
    ) => TEntry;
    emitMessage: () => void;
}

export const createBufferedStream = (): PassThrough => new PassThrough({ highWaterMark: STREAM_HIGH_WATER_MARK });

/**
 * Fails every unacknowledged tunnel write and unblocks a writer parked on the
 * flow-control window, so a dying tunnel never leaves a stalled `write` callback.
 */
export const failPendingTunnelWrites = (entry: PendingTunnelEntry, error: Error): void => {
    for (const pendingAck of entry.pendingWriteAcks.values()) {
        clearTimeout(pendingAck.timeout);
    }

    entry.pendingWriteAcks.clear();
    entry.pendingWriteBytes = 0;

    if (!entry.blockedWriteCallback) {
        return;
    }

    const callback = entry.blockedWriteCallback;
    entry.blockedWriteCallback = undefined;
    callback(error);
};

/**
 * The in-flight correlations of the reverse channel: one entry per request,
 * stream, session or tunnel awaiting the daemon, with idle expiry and the
 * per-kind rules for how a failure surfaces to whoever is waiting.
 */
export default class ReverseChannelPendingEntries {
    #entries = new Map<string, PendingEntry>();
    #lastActivityAt = new Map<string, number>();

    constructor() {
        const sweepTimer = setInterval(() => {
            this.#sweepIdleSessions();
        }, SESSION_SWEEP_INTERVAL_MS);
        sweepTimer.unref();
    }

    get(correlationId: string): PendingEntry | undefined {
        return this.#entries.get(correlationId);
    }

    delete(correlationId: string): void {
        this.#entries.delete(correlationId);
        this.#lastActivityAt.delete(correlationId);
    }

    touch(correlationId: string): void {
        this.#lastActivityAt.set(correlationId, Date.now());
    }

    create<TResult, TEntry extends PendingEntry>(options: PendingPromiseOptions<TResult, TEntry>): Promise<TResult> {
        return new Promise((resolve, reject) => {
            const timeout = options.timeoutMs <= 0
                ? null
                : setTimeout(() => {
                    const entry = this.#entries.get(options.correlationId);
                    if (entry?.type === options.entryType) {
                        this.reject(options.correlationId, entry, new Error(options.timeoutMessage));
                    }
                }, options.timeoutMs);

            this.#entries.set(options.correlationId, options.createEntry(resolve, reject, timeout));
            options.emitMessage();
        });
    }

    rejectSocket(socketId: string, error: Error): void {
        for (const [correlationId, entry] of this.#entries) {
            if (entry.socketId === socketId) {
                this.reject(correlationId, entry, error);
            }
        }
    }

    /**
     * While the attach is still pending the waiting promise is rejected; once it
     * resolved, the only channel left to report on is the stream itself.
     */
    reject(correlationId: string, entry: PendingEntry, error: Error): void {
        this.delete(correlationId);
        clearPendingTimeout(entry.timeout);

        if (entry.timeout) {
            entry.reject(error);
            return;
        }

        switch (entry.type) {
            case 'response':
                entry.reject(error);
                return;

            case 'terminal':
                entry.stream.emit('error', error);
                entry.stream.destroy();
                return;

            case 'websocket':
                entry.stream.emitError(error);
                entry.stream.destroy();
                return;

            case 'tunnel':
                failPendingTunnelWrites(entry, error);
                entry.stream.fail(error);
                return;

            case 'stream':
                entry.stream.emit('error', error);
                entry.stream.destroy();
                entry.reject(error);
                return;
        }
    }

    #sweepIdleSessions(): void {
        const now = Date.now();

        for (const [correlationId, lastActiveAt] of this.#lastActivityAt) {
            if (now - lastActiveAt <= SESSION_IDLE_TTL_MS) {
                continue;
            }

            const entry = this.#entries.get(correlationId);
            if (!entry) {
                this.#lastActivityAt.delete(correlationId);
                continue;
            }

            logger.warn(`[ReverseChannel] Session idle TTL expired — cleaning up sessionId=${correlationId} type=${entry.type}`);

            if (entry.type === 'tunnel') {
                failPendingTunnelWrites(entry, new Error('Tunnel session idle TTL expired'));
                entry.stream.closeRemote();
            } else if (entry.type !== 'response') {
                entry.stream.destroy();
            }

            this.delete(correlationId);
        }
    }
}
