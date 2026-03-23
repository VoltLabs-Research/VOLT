import { Duplex } from 'node:stream';
import type { TeamClusterTunnelStream } from '@modules/team-cluster/utilities/TeamClusterReverseTunnelStream';

interface BinaryRelayDuplexOptions {
    onActivity?: () => void;
    onLocalClose?: (error?: Error | null) => void;
    onRemoteClose?: (error?: Error | null) => void;
}

export class BinaryRelayDuplex extends Duplex implements TeamClusterTunnelStream {
    private transport: Duplex | null = null;
    private closeOrigin: 'local' | 'remote' | null = null;
    private readonly handleTransportData = (chunk: Buffer | string): void => {
        this.options.onActivity?.();
        this.pushChunk(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    };
    private readonly handleTransportDrain = (): void => {
        this.options.onActivity?.();
    };
    private readonly handleTransportEnd = (): void => {
        this.closeRemote();
    };
    private readonly handleTransportClose = (): void => {
        this.closeRemote();
    };
    private readonly handleTransportError = (error: Error): void => {
        this.fail(error);
    };

    constructor(private readonly options: BinaryRelayDuplexOptions = {}) {
        super();
    }

    attach(transport: Duplex): void {
        if (this.transport) {
            throw new Error('Binary relay transport is already attached');
        }

        this.transport = transport;
        this.transport.on('data', this.handleTransportData);
        this.transport.on('drain', this.handleTransportDrain);
        this.transport.on('end', this.handleTransportEnd);
        this.transport.on('close', this.handleTransportClose);
        this.transport.on('error', this.handleTransportError);
    }

    pushChunk(chunk: Buffer): void {
        if (!this.push(chunk)) {
            this.transport?.pause();
        }
    }

    closeRemote(): void {
        if (this.closeOrigin) {
            return;
        }

        this.closeOrigin = 'remote';
        if (!this.readableEnded) {
            this.push(null);
        }
        this.destroy();
    }

    fail(error: Error): void {
        if (!this.closeOrigin) {
            this.closeOrigin = 'remote';
        }

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
        this.transport?.resume();
    }

    override _write(
        chunk: Buffer | string,
        _encoding: BufferEncoding,
        callback: (error?: Error | null) => void
    ): void {
        if (!this.transport || this.transport.destroyed) {
            callback(new Error('Binary relay transport is not attached'));
            return;
        }

        this.options.onActivity?.();
        const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        if (this.transport.write(buffer)) {
            callback();
            return;
        }

        this.transport.once('drain', () => {
            callback();
        });
    }

    override _final(callback: (error?: Error | null) => void): void {
        if (this.transport && !this.transport.destroyed) {
            this.transport.end();
        }

        callback();
    }

    override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
        this.detachTransport();

        if (this.closeOrigin === 'remote') {
            this.options.onRemoteClose?.(error);
        } else {
            this.closeOrigin = 'local';
            this.options.onLocalClose?.(error);
        }

        callback(error);
    }

    private detachTransport(): void {
        if (!this.transport) {
            return;
        }

        this.transport.removeListener('data', this.handleTransportData);
        this.transport.removeListener('drain', this.handleTransportDrain);
        this.transport.removeListener('end', this.handleTransportEnd);
        this.transport.removeListener('close', this.handleTransportClose);
        this.transport.removeListener('error', this.handleTransportError);

        if (!this.transport.destroyed) {
            this.transport.destroy();
        }

        this.transport = null;
    }
}
