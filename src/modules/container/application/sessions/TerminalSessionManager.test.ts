import assert from 'node:assert/strict';
import test from 'node:test';
import { PassThrough } from 'node:stream';
import { REVERSE_CHANNEL } from '@/core/reverse-channel/contracts/reverse-channel-constants';
import { TerminalSessionManager } from './TerminalSessionManager';

const createCoordinator = (cancelled = false) => ({
    beginSessionTransition: (sessionId: string) => ({
        sessionId,
        transitionId: 1
    }),
    cleanupInteractiveSession: () => undefined,
    clearSessionActivityIfUntracked: () => undefined,
    emitSessionData: () => undefined,
    emitSessionEnd: () => undefined,
    endSessionTransition: () => undefined,
    touchSession: () => undefined,
    wasSessionTransitionCancelled: () => cancelled
});

test('cleanupSession closes the terminal attachment explicitly', async () => {
    const stream = new PassThrough();
    let closeCalls = 0;

    const manager = new TerminalSessionManager({
        coordinator: createCoordinator(),
        dockerRuntime: {
            attachTerminal: async () => ({
                stream,
                exec: {
                    resize: async () => undefined
                },
                close: async () => {
                    closeCalls += 1;
                    stream.destroy();
                }
            })
        } as never
    });

    const result = await manager.attachSession({
        sessionId: 'session-1',
        kind: REVERSE_CHANNEL.SessionKind.Terminal,
        containerId: 'container-1'
    });

    assert.equal(result.status, 200);
    assert.equal(manager.terminalStates.size, 1);

    manager.cleanupSession('session-1');
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(closeCalls, 1);
    assert.equal(manager.terminalStates.size, 0);
});

test('attachSession closes the attachment when the session transition is cancelled', async () => {
    const stream = new PassThrough();
    let closeCalls = 0;

    const manager = new TerminalSessionManager({
        coordinator: createCoordinator(true),
        dockerRuntime: {
            attachTerminal: async () => ({
                stream,
                exec: {
                    resize: async () => undefined
                },
                close: async () => {
                    closeCalls += 1;
                    stream.destroy();
                }
            })
        } as never
    });

    const result = await manager.attachSession({
        sessionId: 'session-2',
        kind: REVERSE_CHANNEL.SessionKind.Terminal,
        containerId: 'container-2'
    });

    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(result.status, 409);
    assert.equal(closeCalls, 1);
    assert.equal(manager.terminalStates.size, 0);
});
