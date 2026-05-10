import { Duplex } from 'node:stream';

interface TunnelChunk {
    data: Buffer;
    isBinary: boolean;
}

interface TeamClusterReverseTunnelStreamOptions {
    onWrite: (chunk: TunnelChunk, callback: (error?: Error | null) => void) => void;
    onClose: () => void;
}

export interface TeamClusterTunnelStream extends Duplex {
    pushChunk(chunk: Buffer, onReadyForMore?: () => void): void;
    closeRemote(): void;
    fail(error: Error): void;
    setTimeout(): this;
    setNoDelay(): this;
    setKeepAlive(): this;
    ref(): this;
    unref(): this;
}

export class TeamClusterReverseTunnelStream extends Duplex implements TeamClusterTunnelStream {
    private readonly pendingReadableCallbacks: Array<() => void> = [];

    constructor(private readonly options: TeamClusterReverseTunnelStreamOptions) {
        super();
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
        this.push(null);
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
        const data = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);

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
        const callbacks = this.pendingReadableCallbacks.splice(0);
        for (const pendingCallback of callbacks) {
            pendingCallback();
        }

        this.options.onClose();
        callback(error);
    }
}
