import assert from 'node:assert/strict';
import test from 'node:test';

import { AnalysisWorker } from './AnalysisWorker';
import { EntrypointType } from '@/shared/contracts';

const createWorker = (): AnalysisWorker => {
    return new AnalysisWorker(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never
    );
};

test('AnalysisWorker batch outputs inject serialized local dump paths into context output', () => {
    const worker = createWorker();
    const outputs = worker['buildBatchOutputsMap']({
        binaryObjectPath: 'plugins/multisom.bin',
        entrypointType: EntrypointType.Executable,
        arguments: '--input {{ context.allDumpLocalPaths }}',
        pluginId: 'multisom',
        trajectoryId: 'trajectory-1',
        analysisId: 'analysis-1',
        exposures: [],
        nodeOutputSnapshots: {
            context: {
                trajectory_dumps: [{ path: 'remote-a' }, { path: 'remote-b' }]
            }
        },
        workflow: {
            nodes: [],
            edges: []
        },
        nestedPlugins: [],
        batchMode: true,
        contextNodeId: 'context',
        batchContextVariableName: 'allDumpLocalPaths'
    }, ['/tmp/dump-a.dump', '/tmp/dump-b.dump'], '/tmp/output-dir');

    assert.deepEqual(outputs.get('context'), {
        trajectory_dumps: [{ path: 'remote-a' }, { path: 'remote-b' }],
        allDumpLocalPaths: JSON.stringify(['/tmp/dump-a.dump', '/tmp/dump-b.dump']),
        outputPath: '/tmp/output-dir'
    });
});
