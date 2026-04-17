import { asClass, asFunction, createContainer } from 'awilix';
import { AnalysisDispatchService } from '@/modules/analysis/application/dispatch/AnalysisDispatchService';
import { createDaemonArtifactReporterService } from '@/modules/analysis/application/artifacts/DaemonArtifactReporterService';
import { AnalysisWorker } from '@/modules/analysis/application/execution/AnalysisWorker';
import { WorkflowEngine } from '@/modules/analysis/application/workflow/WorkflowEngine';
import { InlineWorkflowRuntime } from '@/modules/analysis/application/workflow/InlineWorkflowRuntime';
import { DebugEntrypointExecutor } from '@/modules/analysis/application/workflow/debug/DebugEntrypointExecutor';
import { DebugSessionManager } from '@/modules/analysis/application/workflow/debug/DebugSessionManager';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerAnalysisBootstrap = (
    container: BootstrapContainer,
): void => {
    container.register({
        workflowEngine: asClass(WorkflowEngine).singleton(),
        debugEntrypointExecutor: asClass(DebugEntrypointExecutor).singleton(),
        inlineWorkflowRuntime: asClass(InlineWorkflowRuntime).singleton(),
        debugSessionManager: asClass(DebugSessionManager).singleton(),
        analysisDispatchService: asClass(AnalysisDispatchService).singleton(),
        daemonArtifactReporterService: asFunction(createDaemonArtifactReporterService).singleton(),
        analysisWorker: asClass(AnalysisWorker).singleton()
    });
};
