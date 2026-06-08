import ApplicationError from '@/app/coordination/ApplicationError';
import { EntrypointType } from '@/core/runtime/contracts/http-runtime';
import { WorkflowNodeType } from '@/modules/analysis/contracts/workflow.types';
import { WorkflowSession } from '@/modules/analysis/application/workflow/WorkflowSession';
import { buildItemAnalysisJob } from '@/modules/analysis/domain/jobs/analysis-job-factory';
import type {
    WorkflowEngine,
    WorkflowExecutionRequest
} from '@/modules/analysis/application/workflow/WorkflowEngine';
import type {
    AnalysisJobExecutionData,
    AnalysisQueueJobPayload,
    AnalysisStartRequestWithTrace,
    PlannedExecutionItem
} from '@/modules/analysis/contracts/http-analysis';

type WorkflowPlanResult = NonNullable<Awaited<ReturnType<WorkflowEngine['planExecutionStrategy']>>>;

export interface PlanAnalysisWorkflowInput {
    input: AnalysisStartRequestWithTrace;
    workflowEngine: WorkflowEngine;
    serializedTraceContext?: Record<string, string>;
    cachedPlan?: WorkflowPlanResult | null;
}

export interface PlanAnalysisWorkflowResult {
    executionData: AnalysisJobExecutionData;
    jobs: AnalysisQueueJobPayload[];
    plan: WorkflowPlanResult;
}

// Pure planning pipeline used by AnalysisDispatcher. Validates the entrypoint,
// runs the workflow engine planner (unless a cached plan is supplied),
// materializes the AnalysisJobExecutionData snapshot and per-item queue
// payloads.
export const planAnalysisWorkflow = async (
    params: PlanAnalysisWorkflowInput
): Promise<PlanAnalysisWorkflowResult> => {
    const { input, workflowEngine, serializedTraceContext } = params;
    const workflow = input.workflow;
    const entrypoint = workflow.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint)?.data.entrypoint;

    if (!entrypoint?.binaryObjectPath || !entrypoint.arguments) {
        throw ApplicationError.badRequest(
            'Analysis::Start::InvalidEntrypoint',
            'Daemon workflow entrypoint is invalid'
        );
    }

    const planRequest: WorkflowExecutionRequest = {
        ...input,
        userConfig: input.config
    };

    const plan = params.cachedPlan ?? await workflowEngine.planExecutionStrategy(planRequest);

    if (!plan || plan.items.length === 0) {
        throw ApplicationError.unprocessableEntity(
            'Analysis::Start::EmptyExecutionPlan',
            'No items after daemon workflow planning'
        );
    }

    const plannedItems = plan.items as PlannedExecutionItem[];

    const factoryContext = {
        input,
        serializedTraceContext,
        totalItems: plannedItems.length
    };

    const jobs: AnalysisQueueJobPayload[] = plannedItems.map((item, index) => {
        const timestep = item.timestep ?? item.frame;
        if (timestep === undefined) {
            throw ApplicationError.unprocessableEntity(
                'Analysis::Start::MissingTimestep',
                `Missing timestep for analysis job ${input.analysisId}-${index}`
            );
        }

        return buildItemAnalysisJob(factoryContext, item, index, timestep);
    });

    const executionData: AnalysisJobExecutionData = {
        entrypoint: {
            binaryObjectPath: entrypoint.binaryObjectPath,
            ownerClusterId: entrypoint.ownerClusterId,
            arguments: entrypoint.arguments,
            type: entrypoint.type ?? EntrypointType.Executable,
            requirementsFile: entrypoint.requirementsFile,
            entrypointScript: entrypoint.entrypointScript
        },
        identity: {
            pluginId: input.pluginId,
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            teamId: input.teamId,
            computeClusterId: input.teamClusterId,
            storageClusterId: input.analysis.storageClusterId
        },
        workflow: {
            definition: workflow,
            nestedPlugins: input.nestedPlugins,
            pluginReferenceExecutions: input.pluginReferenceExecutions,
            exposures: WorkflowSession.collectExposureDefinitions(workflow),
            forEachNodeId: plan.forEachNodeId,
            nodeOutputSnapshots: plan.nodeOutputSnapshots
        },
        trajectoryFrames: input.trajectoryFrames,
        traceContext: serializedTraceContext
    };

    return { executionData, jobs, plan };
};
