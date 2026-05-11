import assert from 'node:assert/strict';
import test from 'node:test';
import { PassThrough } from 'node:stream';
import { closeTerminalExec } from './DockerRuntime';

test('closeTerminalExec interrupts and exits the shell before destroying the stream', async () => {
    let running = true;
    let written = '';
    const stream = new PassThrough();
    const originalEnd = stream.end.bind(stream);

    stream.on('data', (chunk: Buffer) => {
        written += chunk.toString('utf8');
    });

    stream.end = ((chunk?: string | Buffer, callback?: () => void) => {
        running = false;
        return originalEnd(chunk, callback);
    }) as typeof stream.end;

    await closeTerminalExec(
        stream,
        {
            inspect: async () => ({ Running: running }) as never
        },
        {
            interruptDelayMs: 0,
            pollIntervalMs: 1,
            timeoutMs: 50
        }
    );

    assert.equal(written, '\u0003exit\n');
    assert.equal(stream.destroyed, true);
});

test('closeTerminalExec throws when the terminal exec keeps running after the close sequence', async () => {
    const stream = new PassThrough();

    await assert.rejects(
        () => closeTerminalExec(
            stream,
            {
                inspect: async () => ({ Running: true }) as never
            },
            {
                interruptDelayMs: 0,
                pollIntervalMs: 1,
                timeoutMs: 10
            }
        ),
        /Terminal exec did not exit after close sequence/
    );

    assert.equal(stream.destroyed, true);
});
