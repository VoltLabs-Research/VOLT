import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ReverseChannelBridge } from '../src/reverse-channel/ReverseChannelBridge';
import { DaemonSocketEvent } from '../src/contracts/events';
import type { CommandResult } from '../src/reverse-channel/types';

type Listener = (payload: unknown) => unknown | Promise<unknown>;

class FakeSocket {
    readonly listeners = new Map<string, Listener[]>();
    readonly emitted: Array<{ event: string; payload: any }> = [];

    on(event: string, cb: Listener): this {
        const list = this.listeners.get(event) ?? [];
        list.push(cb);
        this.listeners.set(event, list);
        return this;
    }

    emit(event: string, payload: unknown): this {
        this.emitted.push({ event, payload });
        return this;
    }

    async receive(event: string, payload: unknown): Promise<void> {
        for (const cb of this.listeners.get(event) ?? []) {
            await cb(payload);
        }
    }

    lastResponse(): any {
        return this.emitted[this.emitted.length - 1]?.payload;
    }
}

function bind(bridge: ReverseChannelBridge, socket: FakeSocket): void {
    bridge.bindToSocket(socket as never, 1, () => 1);
}

describe('ReverseChannelBridge command dispatch', () => {
    it('routes a command to its handler and replies ok', async () => {
        const bridge = new ReverseChannelBridge();
        bridge.registerHandler('runtime.uninstall', {
            handle: (): CommandResult => ({ data: { removed: true }, status: 202 })
        });
        const socket = new FakeSocket();
        bind(bridge, socket);

        await socket.receive(DaemonSocketEvent.TeamClusterDaemonMessage, {
            type: 'command',
            requestId: 'r1',
            command: 'runtime.uninstall',
            responseType: 'json',
            payload: {}
        });

        const response = socket.lastResponse();
        assert.equal(response.type, 'response');
        assert.equal(response.requestId, 'r1');
        assert.equal(response.ok, true);
        assert.equal(response.status, 202);
        assert.deepEqual(response.data, { status: 'success', data: { removed: true } });
    });

    it('replies 404 for an unknown command', async () => {
        const bridge = new ReverseChannelBridge();
        const socket = new FakeSocket();
        bind(bridge, socket);

        await socket.receive(DaemonSocketEvent.TeamClusterDaemonMessage, {
            type: 'command',
            requestId: 'r2',
            command: 'does.not.exist',
            responseType: 'json'
        });

        const response = socket.lastResponse();
        assert.equal(response.ok, false);
        assert.equal(response.status, 404);
    });

    it('replies 500 and notifies on handler error', async () => {
        const bridge = new ReverseChannelBridge();
        const errors: unknown[] = [];
        bridge.onError((err) => errors.push(err));
        bridge.registerHandler('runtime.boom', {
            handle: () => {
                throw new Error('handler exploded');
            }
        });
        const socket = new FakeSocket();
        bind(bridge, socket);

        await socket.receive(DaemonSocketEvent.TeamClusterDaemonMessage, {
            type: 'command',
            requestId: 'r3',
            command: 'runtime.boom',
            responseType: 'json'
        });

        assert.equal(socket.lastResponse().ok, false);
        assert.equal(socket.lastResponse().status, 500);
        assert.equal(errors.length, 1);
    });

    it('forwards non-command messages to onMessage subscribers', async () => {
        const bridge = new ReverseChannelBridge();
        const received: unknown[] = [];
        bridge.onMessage((message) => received.push(message));
        const socket = new FakeSocket();
        bind(bridge, socket);

        const sessionInput = { type: 'session-input', sessionId: 's1', chunkBase64: 'AA==', isBinary: false };
        await socket.receive(DaemonSocketEvent.TeamClusterDaemonMessage, sessionInput);

        assert.deepEqual(received, [sessionInput]);
    });

    it('unregisters handlers', async () => {
        const bridge = new ReverseChannelBridge();
        bridge.registerHandler('runtime.x', { handle: () => ({ data: {} }) });
        bridge.unregisterHandler('runtime.x');
        const socket = new FakeSocket();
        bind(bridge, socket);

        await socket.receive(DaemonSocketEvent.TeamClusterDaemonMessage, {
            type: 'command',
            requestId: 'r4',
            command: 'runtime.x',
            responseType: 'json'
        });

        assert.equal(socket.lastResponse().ok, false);
        assert.equal(socket.lastResponse().status, 404);
    });
});
