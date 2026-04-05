import assert from 'node:assert/strict';
import test from 'node:test';
import { DaemonCommandError } from '@/modules/cloud-control/services/DaemonCommandError';
import { AnalysisDispatchService } from './AnalysisDispatchService';

class StubWorkflowEngine {
    constructor(private readonly items: Array<Record<string, unknown>>) {}

    async planExecutionStrategy() {
        return {
            items: this.items,
            batchMode: false
        };
    }
}

class StubQueueService {
    async enqueue(): Promise<void> {}
}

class StubAnalysisExecutionDataStore {
    async store(): Promise<undefined> {
        return undefined;
    }
}

class StubRuntimeEventBroker {
    emitProgress(): void {}
}

const buildRequest = () => ({
    analysis: {
        _id: 'analysis-1',
        pluginDisplayName: 'Example Plugin',
        team: 'team-1',
        status: 'pending'
    },
    analysisId: 'analysis-1',
    pluginId: 'plugin-1',
    pluginDisplayName: 'Example Plugin',
    teamId: 'team-1',
    teamClusterId: 'compute-1',
    trajectoryId: 'trajectory-1',
    trajectoryName: 'Trajectory 1',
    trajectoryFrames: [{
        timestep: 1,
        natoms: 64,
        simulationCell: '10 0 0 0 10 0 0 0 10'
    }],
    workflow: {
        nodes: [{
            id: 'entrypoint',
            type: 'entrypoint',
            position: { x: 0, y: 0 },
            data: {
                entrypoint: {}
            }
        }],
        edges: []
    },
    nestedPlugins: [],
    pluginReferenceExecutions: [],
    config: {}
});

test('AnalysisDispatchService rejects invalid entrypoint data as an operational daemon error', async () => {
    const service = new AnalysisDispatchService(
        new StubWorkflowEngine([{
            timestep: 1,
            path: 'trajectory-1/timestep-1.dump.zst',
            natoms: 64,
            simulationCell: '10 0 0 0 10 0 0 0 10'
        }]) as any,
        new StubQueueService() as any,
        new StubAnalysisExecutionDataStore() as any,
        new StubRuntimeEventBroker() as any
    );

    await assert.rejects(
        () => service.startAnalysis(buildRequest() as any),
        (error: unknown) => {
            assert.ok(error instanceof DaemonCommandError);
            assert.equal(error.statusCode, 400);
            assert.equal(error.code, 'Analysis::Start::InvalidEntrypoint');
            return true;
        }
    );
});
