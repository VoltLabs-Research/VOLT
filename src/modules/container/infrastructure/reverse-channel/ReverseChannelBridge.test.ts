import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import net from 'node:net';
import test from 'node:test';
import { REVERSE_CHANNEL } from '@/core/reverse-channel/contracts/reverse-channel-constants';
import { encodeEnvelope, EnvelopeKind } from '@/core/reverse-channel/contracts/binary-envelope';
import { ReverseChannelBridge } from './ReverseChannelBridge';

type CommandHandler = {
    handle: (payload?: object, ctx?: unknown) => Promise<{ status?: number; data?: object | null }>;
};

type Harness = {
    bridge: ReverseChannelBridge;
    handlers: Map<string, CommandHandler>;
    emittedMessages: unknown[];
    receiveMessage: (message: unknown) => void;
};

class FakeSocket extends EventEmitter {
    destroyed = false;
    closed = false;
    writable = true;
    writableEnded = false;
    writeCalls = 0;
    destroyCalls = 0;
    emitErrorOnDestroy: Error | null = null;
    nextWriteError: Error | null = null;

    setNoDelay(): this {
        return this;
    }

    setTimeout(_timeout: number, callback?: () => void): this {
        if (callback) {
            this.on('timeout', callback);
        }

        return this;
    }

    pause(): this {
        return this;
    }

    resume(): this {
        return this;
    }

    write(chunk: Uint8Array, callback?: (error?: Error | null) => void): boolean {
        this.writeCalls += 1;

        if (!this.writable || this.destroyed || this.writableEnded) {
            const error = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
            callback?.(error);
            this.emit('error', error);
            return false;
        }

        if (this.nextWriteError) {
            const error = this.nextWriteError;
            this.nextWriteError = null;
            callback?.(error);
            this.emit('error', error);
            return false;
        }

        if (chunk.byteLength === 0) {
            callback?.(null);
            return true;
        }

        callback?.(null);
        return true;
    }

    destroy(): this {
        this.destroyCalls += 1;
        this.destroyed = true;
        this.closed = true;
        this.writable = false;
        this.writableEnded = true;

        if (this.emitErrorOnDestroy) {
            this.emit('error', this.emitErrorOnDestroy);
        }

        this.emit('close');
        return this;
    }
}

const createHarness = (): Harness => {
    const handlers = new Map<string, CommandHandler>();
    const emittedMessages: unknown[] = [];
    let onMessageListener: ((message: unknown) => void) | null = null;

    const client = {
        registerHandler(command: string, handler: CommandHandler) {
            handlers.set(command, handler);
            return this;
        },
        onMessage(listener: (message: unknown) => void) {
            onMessageListener = listener;
            return this;
        },
        onDisconnected() {
            return this;
        }
    };

    const bridge = new ReverseChannelBridge();
    bridge.bindToClient({
        client,
        emitMessage(message: unknown) {
            emittedMessages.push(message);
        }
    } as never);

    return {
        bridge,
        handlers,
        emittedMessages,
        receiveMessage(message: unknown) {
            assert.ok(onMessageListener, 'Expected reverse channel message listener');
            onMessageListener(message);
        }
    };
};

const createTunnelDataPayload = (sessionId: string, payload: Uint8Array = new Uint8Array([1, 2, 3])) => ({
    type: 'tunnel-data',
    sessionId,
    chunk: encodeEnvelope(0, EnvelopeKind.StreamChunk, payload),
    isBinary: true,
    sequence: 1,
    requiresAck: true
});

test('bindToClient registers session.attach and routes it through attachSession', async () => {
    const harness = createHarness();

    const sessionAttachHandler = harness.handlers.get('session.attach');
    assert.ok(sessionAttachHandler, 'Expected session.attach to be registered');

    const result = await sessionAttachHandler.handle({
        sessionId: 'session-1',
        kind: REVERSE_CHANNEL.SessionKind.Terminal,
        containerId: 'container-1'
    });

    assert.equal(result.status, 503);
    assert.deepEqual(result.data, {
        status: 'error',
        message: 'Terminal services are not available'
    });
    assert.deepEqual(harness.emittedMessages, [{
        type: 'session-end',
        sessionId: 'session-1',
        error: 'Terminal services are not available'
    }]);
});

test('does not write tunnel-data when tunnel socket is no longer writable', (t) => {
    const fakeSocket = new FakeSocket();
    const createConnectionMock = t.mock.method(net, 'createConnection', () => fakeSocket as unknown as net.Socket);

    const harness = createHarness();
    const sessionId = 'tunnel-stale-write';

    harness.receiveMessage({
        type: 'tunnel-open',
        sessionId,
        targetHost: '127.0.0.1',
        targetPort: 8080,
        accessMode: 'http'
    });

    assert.equal(createConnectionMock.mock.callCount(), 1);

    fakeSocket.writable = false;
    fakeSocket.writableEnded = true;
    fakeSocket.closed = true;

    harness.emittedMessages.length = 0;

    assert.doesNotThrow(() => {
        harness.receiveMessage(createTunnelDataPayload(sessionId));
    });

    assert.equal(fakeSocket.writeCalls, 0, 'Expected no write attempts to a non-writable socket');
    assert.deepEqual(harness.emittedMessages, [{
        type: 'tunnel-close',
        sessionId
    }]);
});

test('cleanup keeps a fallback error listener during destroy to avoid uncaught socket errors', (t) => {
    const fakeSocket = new FakeSocket();
    fakeSocket.emitErrorOnDestroy = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });

    const createConnectionMock = t.mock.method(net, 'createConnection', () => fakeSocket as unknown as net.Socket);

    const harness = createHarness();
    const sessionId = 'tunnel-cleanup-error-race';

    harness.receiveMessage({
        type: 'tunnel-open',
        sessionId,
        targetHost: '127.0.0.1',
        targetPort: 8080,
        accessMode: 'http'
    });

    assert.equal(createConnectionMock.mock.callCount(), 1);

    assert.doesNotThrow(() => {
        harness.receiveMessage({
            type: 'tunnel-close',
            sessionId
        });
    });

    assert.equal(fakeSocket.destroyCalls, 1);
    assert.equal(fakeSocket.destroyed, true);
});

test('write callback errors close the tunnel once without uncaught socket errors', (t) => {
    const fakeSocket = new FakeSocket();
    fakeSocket.nextWriteError = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });

    const createConnectionMock = t.mock.method(net, 'createConnection', () => fakeSocket as unknown as net.Socket);

    const harness = createHarness();
    const sessionId = 'tunnel-write-callback-error';

    harness.receiveMessage({
        type: 'tunnel-open',
        sessionId,
        targetHost: '127.0.0.1',
        targetPort: 8080,
        accessMode: 'http'
    });

    assert.equal(createConnectionMock.mock.callCount(), 1);

    harness.emittedMessages.length = 0;

    assert.doesNotThrow(() => {
        harness.receiveMessage(createTunnelDataPayload(sessionId));
    });

    assert.equal(fakeSocket.writeCalls, 1);

    const closedStateMessages = harness.emittedMessages.filter((message) => {
        const payload = message as { type?: string; status?: string };
        return payload.type === 'tunnel-state'
            && payload.status === REVERSE_CHANNEL.TunnelSessionStatus.Closed;
    });

    assert.equal(closedStateMessages.length, 1);
});
