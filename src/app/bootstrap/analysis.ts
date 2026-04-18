import { asClass, createContainer } from 'awilix';
import { AnalysisDispatcher } from '@/modules/analysis/application/analysis/AnalysisDispatcher';
import { DaemonArtifactReporter } from '@/modules/analysis/application/analysis/DaemonArtifactReporter';
import { AnalysisWorker } from '@/modules/analysis/application/workers/AnalysisWorker';
import { AnalysisEnvironment } from '@/modules/analysis/application/workflow/AnalysisEnvironment';
import { WorkflowEngine } from '@/modules/analysis/application/workflow/WorkflowEngine';
import { WorkflowRuntime } from '@/modules/analysis/application/workflow/WorkflowRuntime';
import { DebugEnvironment } from '@/modules/analysis/application/workflow/debug/DebugEnvironment';
import { DebugSessionManager } from '@/modules/analysis/application/workflow/debug/DebugSessionManager';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerAnalysisBootstrap = (
    container: BootstrapContainer,
): void => {
    container.register({
        workflowEngine: asClass(WorkflowEngine).singleton(),
        debugEnvironment: asClass(DebugEnvironment).singleton(),
        workflowRuntime: asClass(WorkflowRuntime).singleton(),
        debugSessionManager: asClass(DebugSessionManager).singleton(),
        analysisDispatcher: asClass(AnalysisDispatcher).singleton(),
        daemonArtifactReporter: asClass(DaemonArtifactReporter).singleton(),
        analysisEnvironment: asClass(AnalysisEnvironment).singleton(),
        analysisWorker: asClass(AnalysisWorker).singleton()
    });
};
