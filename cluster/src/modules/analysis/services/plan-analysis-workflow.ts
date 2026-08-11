import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { EntrypointType } from '@shared/contracts/types/http-runtime';
import { WorkflowNodeType } from '@shared/contracts/types/workflow.types';
import { WorkflowSession } from '@modules/analysis/services/workflow/WorkflowSession';
import { buildItemAnalysisJob } from '@modules/analysis/services/analysis-job-factory';
import type {
    WorkflowEngine,
    WorkflowExecutionRequest
} from '@modules/analysis/services/workflow/WorkflowEngine';
import type {
    AnalysisJobExecutionData,
    AnalysisQueueJobPayload,
    AnalysisStartRequestWithTrace,
    PlannedExecutionItem
} from '@shared/contracts/types/http-analysis';

interface PlanAnalysisWorkflowInput {
    input: AnalysisStartRequestWithTrace;
    workflowEngine: WorkflowEngine;
    serializedTraceContext?: Record<string, string>;
}

interface PlanAnalysisWorkflowResult {
    executionData: AnalysisJobExecutionData;
    jobs: AnalysisQueueJobPayload[];
}

export const planAnalysisWorkflow = async (
    params: PlanAnalysisWorkflowInput
): Promise<PlanAnalysisWorkflowResult> => {
    const { input, workflowEngine, serializedTraceContext } = params;
    const workflow = input.workflow;
    const entrypoint = workflow.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint)?.data.entrypoint;

    if (!entrypoint?.binaryObjectPath || !entrypoint.arguments) {
        throw ApplicationError.badRequest(
            ErrorCodes.ANALYSIS_START_INVALID_ENTRYPOINT,
            'Daemon workflow entrypoint is invalid'
        );
    }

    const planRequest: WorkflowExecutionRequest = {
        ...input,
        userConfig: input.config
    };

    const plan = await workflowEngine.planExecutionStrategy(planRequest);

    if (!plan || plan.items.length === 0) {
        throw ApplicationError.unprocessableEntity(
            ErrorCodes.ANALYSIS_START_EMPTY_EXECUTION_PLAN,
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
                ErrorCodes.ANALYSIS_START_MISSING_TIMESTEP,
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
            trajectoryWindowNodeId: plan.trajectoryWindowNodeId,
            nodeOutputSnapshots: plan.nodeOutputSnapshots
        },
        trajectoryFrames: input.trajectoryFrames,
        traceContext: serializedTraceContext
    };

    return {
        executionData,
        jobs
    };
};
