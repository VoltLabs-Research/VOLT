import { Duplex } from 'node:stream';

interface TunnelChunk {
    data: Buffer;
    isBinary: boolean;
}

interface TeamClusterReverseTunnelStreamOptions {
    onWrite: (chunk: TunnelChunk) => void;
    onClose: () => void;
}

export interface TeamClusterTunnelStream extends Duplex {
    pushChunk(chunk: Buffer): void;
    closeRemote(): void;
    fail(error: Error): void;
    setTimeout(): this;
    setNoDelay(): this;
    setKeepAlive(): this;
    ref(): this;
    unref(): this;
}

export class TeamClusterReverseTunnelStream extends Duplex implements TeamClusterTunnelStream {
    constructor(private readonly options: TeamClusterReverseTunnelStreamOptions) {
        super();
    }

    pushChunk(chunk: Buffer): void {
        this.push(chunk);
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

    override _read(): void {}

    override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
        const data = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
        this.options.onWrite({
            data,
            isBinary: true
        });
        callback();
    }

    override _final(callback: (error?: Error | null) => void): void {
        callback();
    }

    override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
        this.options.onClose();
        callback(error);
    }
}
