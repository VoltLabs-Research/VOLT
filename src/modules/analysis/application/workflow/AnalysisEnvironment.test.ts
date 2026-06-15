import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { spawnSync } from 'node:child_process';

import { AnalysisEnvironment } from './AnalysisEnvironment';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import type { AnalysisJobExecutionData, AnalysisJobMetadata } from '@/modules/analysis/contracts/http-analysis';

// A minimal zstd-compressed payload (real .dump content is irrelevant — the
// environment only localizes paths; parsing happens in the plugin binary).
const zstdCompress = (text: string): Buffer => {
    const result = spawnSync('zstd', ['-q', '-c'], { input: Buffer.from(text), maxBuffer: 1 << 20 });
    if (result.status !== 0) {
        throw new Error(`zstd compress failed: ${result.stderr}`);
    }
    return result.stdout;
};

interface FakeStore {
    store: ClusterObjectStore;
    requestedKeys: string[];
}

const makeFakeStore = (): FakeStore => {
    const requestedKeys: string[] = [];
    const store = {
        getStream: async (_ownerClusterId: string, _bucket: string, objectKey: string) => {
            requestedKeys.push(objectKey);
            return { metadata: {}, stream: Readable.from([zstdCompress(`dump for ${objectKey}`)]) };
        }
    } as unknown as ClusterObjectStore;

    return { store, requestedKeys };
};

const FRAMES = [0, 10, 20, 30, 40].map((timestep) => ({
    timestep,
    natoms: 100,
    simulationCell: '0 10 0 10 0 10'
}));

const buildExecutionData = (overrides: Partial<AnalysisJobExecutionData['workflow']> = {}): AnalysisJobExecutionData => ({
    entrypoint: {
        binaryObjectPath: 'plugins/demo/main',
        arguments: '{{ trajectory-window.framePaths }}',
        type: 'executable' as never
    },
    identity: {
        pluginId: 'plugin-1',
        trajectoryId: 'traj-1',
        analysisId: 'analysis-1',
        teamId: 'team-1',
        storageClusterId: 'storage-1'
    },
    workflow: {
        definition: { nodes: [], edges: [] },
        nestedPlugins: [],
        exposures: [],
        nodeOutputSnapshots: {},
        ...overrides
    },
    trajectoryFrames: FRAMES
});

const buildMetadata = (overrides: Partial<AnalysisJobMetadata> = {}): AnalysisJobMetadata => ({
    trajectoryId: 'traj-1',
    analysisId: 'analysis-1',
    name: 'Window Plugin',
    config: {},
    plugin: 'plugin-1',
    totalItems: 1,
    ...overrides
});

test('prepare downloads each window timestep once and builds one target per frame', async () => {
    const { store, requestedKeys } = makeFakeStore();
    const env = new AnalysisEnvironment(store);

    const runtime = await env.prepare(
        buildExecutionData({ trajectoryWindowNodeId: 'window-1' }),
        buildMetadata({ windowMode: 'window', windowSize: 3, windowTimesteps: [0, 10, 20] }),
        10
    );

    try {
        assert.equal(runtime.dumpTargets.length, 3, 'one target per window frame');
        assert.deepEqual(runtime.dumpTargets.map((target) => target.timestep), [0, 10, 20]);
        assert.equal(runtime.primaryFrameIndex, 1, 'primary frame 10 is index 1 in the window');
        assert.equal(requestedKeys.length, 3, 'three distinct dumps downloaded');

        // The TrajectoryWindow node output is seeded with the localized window.
        const windowOutput = runtime.outputs.get('window-1');
        assert.ok(windowOutput, 'window node output seeded');
        assert.equal(windowOutput!.count, 3);
        assert.equal((windowOutput!.primaryValue as { timestep: number }).timestep, 10);
        assert.equal(typeof windowOutput!.framePaths, 'string');
    } finally {
        await env.cleanup(runtime);
    }
});

test('prepare dedupes a referencePair whose reference equals the primary frame', async () => {
    const { store, requestedKeys } = makeFakeStore();
    const env = new AnalysisEnvironment(store);

    const runtime = await env.prepare(
        buildExecutionData({ trajectoryWindowNodeId: 'window-1' }),
        buildMetadata({ windowMode: 'referencePair', referenceTimestep: 0, windowTimesteps: [0, 0] }),
        0
    );

    try {
        assert.equal(requestedKeys.length, 1, 'identical timesteps downloaded once');
        assert.equal(runtime.dumpTargets.length, 2, 'window still exposes both frame slots');
        assert.equal(runtime.dumpLocalPaths.length, 1, 'one localized path tracked for cleanup');
    } finally {
        await env.cleanup(runtime);
    }
});

test('prepare single-frame path (no window metadata) downloads exactly one dump', async () => {
    const { store, requestedKeys } = makeFakeStore();
    const env = new AnalysisEnvironment(store);

    const runtime = await env.prepare(
        buildExecutionData({ forEachNodeId: 'foreach-1' }),
        buildMetadata({ forEachItem: { timestep: 20 }, forEachIndex: 2 }),
        20
    );

    try {
        assert.equal(requestedKeys.length, 1, 'window-of-1 downloads a single dump');
        assert.equal(runtime.dumpTargets.length, 1);
        assert.equal(runtime.dumpTargets[0].timestep, 20);
        assert.equal(runtime.primaryFrameIndex, 0);

        // forEach currentValue is localized to the primary dump (unchanged single-frame behavior).
        const forEachOutput = runtime.outputs.get('foreach-1');
        assert.ok(forEachOutput, 'forEach node output seeded');
        assert.equal((forEachOutput!.currentValue as { path: string }).path, runtime.dumpTargets[0].localPath);
    } finally {
        await env.cleanup(runtime);
    }
});
