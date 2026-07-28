import test from 'node:test';
import assert from 'node:assert/strict';

import { planAnalysisWorkflow } from '@modules/analysis/services/plan-analysis-workflow';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import type {
    WorkflowEngine,
    WorkflowExecutionRequest
} from '@modules/analysis/services/workflow/WorkflowEngine';
import type { AnalysisStartRequestWithTrace } from '@shared/contracts/types/http-analysis';
import type { WorkflowDefinition } from '@shared/contracts/types/http-workflow';

type WorkflowPlanResult = NonNullable<Awaited<ReturnType<WorkflowEngine['planExecutionStrategy']>>>;

interface FakeEngine {
    engine: WorkflowEngine;
    calls: WorkflowExecutionRequest[];
}

const makeFakeEngine = (plan: WorkflowPlanResult | null): FakeEngine => {
    const calls: WorkflowExecutionRequest[] = [];
    const engine = {
        planExecutionStrategy: async (request: WorkflowExecutionRequest): Promise<WorkflowPlanResult | null> => {
            calls.push(request);
            return plan;
        }
    };

    return { engine: engine as unknown as WorkflowEngine, calls };
};

const buildWorkflow = (): WorkflowDefinition => ({
    nodes: [
        {
            id: 'entrypoint-1',
            type: WorkflowNodeType.Entrypoint,
            position: { x: 0, y: 0 },
            data: {
                entrypoint: {
                    binaryObjectPath: 'plugins/demo/main',
                    arguments: '--frame {{timestep}}',
                    ownerClusterId: 'cluster-1'
                }
            }
        }
    ],
    edges: []
});

const buildInput = (): AnalysisStartRequestWithTrace => ({
    analysis: { _id: 'analysis-doc-1', pluginDisplayName: 'Demo Plugin', storageClusterId: 'storage-1' },
    analysisId: 'analysis-1',
    pluginId: 'plugin-1',
    pluginDisplayName: 'Demo Plugin',
    teamId: 'team-1',
    teamClusterId: 'team-cluster-1',
    trajectoryId: 'traj-1',
    trajectoryFramesCompressed: '',
    workflowCompressed: '',
    nestedPluginsCompressed: '',
    pluginReferenceExecutionsCompressed: '',
    config: { mode: 'fast' },
    trajectoryFrames: [],
    workflow: buildWorkflow(),
    nestedPlugins: [],
    pluginReferenceExecutions: []
});

const buildPlan = (): WorkflowPlanResult => ({
    items: [{ timestep: 0 }, { timestep: 10 }, { frame: 20 }],
    forEachNodeId: 'foreach-1',
    nodeOutputSnapshots: { 'entrypoint-1': {} }
});

test('planAnalysisWorkflow calls planExecutionStrategy exactly once and maps items -> jobs', async () => {
    const plan = buildPlan();
    const { engine, calls } = makeFakeEngine(plan);
    const input = buildInput();

    const result = await planAnalysisWorkflow({ input, workflowEngine: engine });

    assert.equal(calls.length, 1, 'planExecutionStrategy should be called exactly once');

    assert.equal(result.jobs.length, plan.items.length);
    assert.deepEqual(result.jobs.map((job) => job.timestep), [0, 10, 20]);
    assert.deepEqual(
        result.jobs.map((job) => job.jobId),
        ['analysis-1-0', 'analysis-1-1', 'analysis-1-2']
    );
    assert.deepEqual(result.jobs.map((job) => job.metadata?.itemIndex), [0, 1, 2]);

    assert.equal(result.plan, plan);
    assert.equal(result.executionData.workflow.forEachNodeId, 'foreach-1');
    assert.equal(result.executionData.identity.analysisId, 'analysis-1');
    assert.equal(result.executionData.entrypoint.binaryObjectPath, 'plugins/demo/main');
});

test('planAnalysisWorkflow forwards the planning request with userConfig === input.config', async () => {
    const { engine, calls } = makeFakeEngine(buildPlan());
    const input = buildInput();

    await planAnalysisWorkflow({ input, workflowEngine: engine });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].userConfig, input.config);
    assert.equal(calls[0].pluginId, 'plugin-1');
    assert.equal(calls[0].trajectoryId, 'traj-1');
});

test('planAnalysisWorkflow recomputes the plan on every invocation (no plan cache)', async () => {
    const { engine, calls } = makeFakeEngine(buildPlan());
    const input = buildInput();

    await planAnalysisWorkflow({ input, workflowEngine: engine });
    await planAnalysisWorkflow({ input, workflowEngine: engine });

    assert.equal(calls.length, 2, 'each call must re-plan; no cached plan may be reused');
});

test('planAnalysisWorkflow rejects an empty execution plan', async () => {
    const { engine } = makeFakeEngine({ items: [], nodeOutputSnapshots: {} });
    const input = buildInput();

    await assert.rejects(
        () => planAnalysisWorkflow({ input, workflowEngine: engine }),
        (error: unknown) => error instanceof ApplicationError
            && error.code === 'Analysis::Start::EmptyExecutionPlan'
    );
});
