import { Duplex } from 'node:stream';

interface TunnelChunk {
    data: Buffer;
    isBinary: boolean;
}

interface TeamClusterReverseTunnelStreamOptions {
    onWrite: (chunk: TunnelChunk, callback: (error?: Error | null) => void) => void;
    onClose: () => void;
}

/**
 * A Duplex that also answers the `net.Socket` surface Node's HTTP agent pokes at,
 * so a reverse-channel tunnel can back an `http.Agent` connection.
 */
export class TeamClusterReverseTunnelStream extends Duplex {
    private readonly pendingReadableCallbacks: Array<() => void> = [];
    private remoteClosed = false;
    private remoteCloseDestroyTimer: NodeJS.Timeout | null = null;

    /*
     * A default 16 KiB watermark is the wrong size for a tunnel: the daemon reads
     * from its socket in chunks up to 64 KiB, so `push` reports "full" on the first
     * one and the reader parks the drain callback until `_read` runs. That collapses
     * the in-flight window to roughly a single chunk and turns a bulk transfer into
     * one round trip per chunk. The daemon still bounds memory on its side by
     * pausing the source above its own 8 MiB window.
     */
    constructor(private readonly options: TeamClusterReverseTunnelStreamOptions) {
        super({
            readableHighWaterMark: 1024 * 1024,
            writableHighWaterMark: 1024 * 1024
        });
    }

    pushChunk(chunk: Buffer, onReadyForMore?: () => void): void {
        const readyForMore = this.push(chunk);
        if (!onReadyForMore) {
            return;
        }

        if (readyForMore) {
            onReadyForMore();
            return;
        }

        this.pendingReadableCallbacks.push(onReadyForMore);
    }

    closeRemote(): void {
        if (this.remoteClosed) {
            return;
        }

        this.remoteClosed = true;
        this.push(null);
        this.once('end', () => {
            this.destroyAfterRemoteEnd();
        });

        this.remoteCloseDestroyTimer = setTimeout(() => {
            this.destroyAfterRemoteEnd();
        }, 30_000);
        this.remoteCloseDestroyTimer.unref();
    }

    fail(error: Error): void {
        this.destroy(error);
    }

    setTimeout(): this {
        return this;
    }

    setNoDelay(): this {
        return this;
    }

    setKeepAlive(): this {
        return this;
    }

    ref(): this {
        return this;
    }

    unref(): this {
        return this;
    }

    override _read(): void {
        const callbacks = this.pendingReadableCallbacks.splice(0);
        for (const callback of callbacks) {
            callback();
        }
    }

    override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        const data = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;

        let settled = false;
        const done = (error?: Error | null): void => {
            if (settled) {
                return;
            }

            settled = true;
            callback(error);
        };

        try {
            this.options.onWrite({
                data,
                isBinary: true
            }, done);
        } catch (error) {
            done(error instanceof Error ? error : new Error(String(error)));
        }
    }

    override _final(callback: (error?: Error | null) => void): void {
        callback();
    }

    override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
        if (this.remoteCloseDestroyTimer) {
            clearTimeout(this.remoteCloseDestroyTimer);
            this.remoteCloseDestroyTimer = null;
        }

        const callbacks = this.pendingReadableCallbacks.splice(0);
        for (const pendingCallback of callbacks) {
            pendingCallback();
        }

        this.options.onClose();
        callback(error);
    }

    private destroyAfterRemoteEnd(): void {
        if (this.remoteCloseDestroyTimer) {
            clearTimeout(this.remoteCloseDestroyTimer);
            this.remoteCloseDestroyTimer = null;
        }

        if (!this.destroyed) {
            this.destroy();
        }
    }
}
