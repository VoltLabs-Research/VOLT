import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PluginProcessChannel } from '@modules/plugin/services/runtime/PluginProcessChannel';
import { resolvePythonStubPath } from '@modules/plugin/services/runtime/python-stub-path';
import type { ProcessExecutionLogChunk, ProcessExecutionLogSink } from '@shared/contracts/types/execution-log';
import type { PluginProgressDirective } from '@volt/contracts/modules/plugin/progress';

const PYTHON = 'python3';
const hasPython = spawnSync(PYTHON, ['--version']).status === 0;

const PLUGIN_SOURCE = `
import os
import subprocess

print("imported")


def process(frame, config):
    if config.get("mode") == "generator":
        return _generator(config)
    print("hello from process")
    os.write(1, b"raw write to fd 1\\n")
    subprocess.Popen(["echo", "child output"]).wait()
    return {"n": config.get("n")}


def _generator(config):
    yield "Meshing"
    for index in range(4):
        yield (index + 1) / 4
    return {"cells": 4}
`;

// stderr is a pipe of its own, so its last lines may land just after the response.
const STDERR_SETTLE_MS = 100;

interface RecordingSink extends ProcessExecutionLogSink {
    text: () => string;
    directives: PluginProgressDirective[];
}

const recordingSink = (): RecordingSink => {
    const chunks: ProcessExecutionLogChunk[] = [];
    const directives: PluginProgressDirective[] = [];
    return {
        handleChunk: (chunk) => {
            chunks.push(chunk);
        },
        handleProgress: (directive) => {
            directives.push(directive);
        },
        text: () => chunks.map((chunk) => chunk.text).join(''),
        directives
    };
};

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, STDERR_SETTLE_MS));

describe('volt_plugin_stub', { skip: !hasPython && 'python3 is not available' }, () => {
    let pluginRoot: string;
    let channel: PluginProcessChannel;

    before(async () => {
        pluginRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'volt-stub-test-'));
        await fs.writeFile(path.join(pluginRoot, 'main.py'), PLUGIN_SOURCE);
        channel = new PluginProcessChannel({
            pluginId: 'stub-test',
            commandPath: PYTHON,
            stubPath: resolvePythonStubPath(),
            pluginRoot,
            entrypointScript: 'main.py'
        }, 'stub-test', 20_000);
        await channel.waitUntilReady();
    });

    after(async () => {
        await channel.destroy();
        await fs.rm(pluginRoot, {
            recursive: true,
            force: true
        });
    });

    test('what the plugin prints reaches its log, not the frames its responses travel in', async () => {
        const sink = recordingSink();
        const first = await channel.send({
            opcode: 'process',
            config: { n: 1 }
        }, { logSink: sink });
        const second = await channel.send({
            opcode: 'process',
            config: { n: 2 }
        }, { logSink: sink });

        assert.deepEqual(first, {
            ok: true,
            result: { n: 1 }
        });
        assert.deepEqual(second, {
            ok: true,
            result: { n: 2 }
        });
        await settle();
        assert.match(sink.text(), /hello from process/);
        assert.match(sink.text(), /raw write to fd 1/);
        assert.match(sink.text(), /child output/);
    });

    test('a process() that yields reports its progress and returns its result', async () => {
        const sink = recordingSink();
        const response = await channel.send({
            opcode: 'process',
            config: { mode: 'generator' }
        }, { logSink: sink });

        assert.deepEqual(response, {
            ok: true,
            result: { cells: 4 }
        });
        await settle();
        assert.deepEqual(sink.directives[0], { text: 'Meshing' });
        assert.deepEqual(sink.directives.at(-1), { progress: 1 });
        assert.doesNotMatch(sink.text(), /@volt:/);
    });
});
