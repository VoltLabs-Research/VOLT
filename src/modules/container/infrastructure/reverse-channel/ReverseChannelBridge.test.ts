import assert from 'node:assert/strict';
import test from 'node:test';
import { REVERSE_CHANNEL } from '@/core/reverse-channel/contracts/reverse-channel-constants';
import { ReverseChannelBridge } from './ReverseChannelBridge';

test('bindToClient registers session.attach and routes it through attachSession', async () => {
    const handlers = new Map<string, {
        handle: (payload?: object, ctx?: unknown) => Promise<{ status?: number; data?: object | null }>;
    }>();
    const emittedMessages: unknown[] = [];

    const client = {
        registerHandler(command: string, handler: { handle: (payload?: object, ctx?: unknown) => Promise<{ status?: number; data?: object | null }> }) {
            handlers.set(command, handler);
            return this;
        },
        onMessage() {
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

    const sessionAttachHandler = handlers.get('session.attach');
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
    assert.deepEqual(emittedMessages, [{
        type: 'session-end',
        sessionId: 'session-1',
        error: 'Terminal services are not available'
    }]);
});
