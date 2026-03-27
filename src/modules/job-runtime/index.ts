import { AnalysisDispatchService, AnalysisWorker, createBinaryExecutorService, createPluginBinaryCacheService, createJobControlService } from './services';
import type { ArtifactUploadQueueService, ResultProcessorService } from '@/modules/artifacts/services';
import type { AnalysisExecutionDataStore } from '@/modules/platform/services';
import type { WorkflowEngine } from '@/modules/workflow-runtime/services';
import type { RuntimeEventBroker } from '@/shared/services';
import type { QueueService } from '@/modules/platform/services';
import type { DaemonJobReporterService } from '@/modules/cloud-control/services';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';

export interface JobRuntimeModule {
    analysisDispatchService: AnalysisDispatchService;
}

export const createJobRuntimeModule = (deps: {
    workflowEngine: WorkflowEngine;
    queueService: QueueService;
    analysisExecutionDataStore: AnalysisExecutionDataStore;
    eventBroker: RuntimeEventBroker;
}): JobRuntimeModule => {
    const analysisDispatchService = new AnalysisDispatchService(
        deps.workflowEngine,
        deps.queueService,
        deps.analysisExecutionDataStore,
        deps.eventBroker
    );

    return {
        analysisDispatchService
    };
};

export const createAnalysisWorker = (deps: {
    queueService: QueueService;
    analysisExecutionDataStore: AnalysisExecutionDataStore;
    objectStore: ClusterObjectStore;
    artifactUploadQueueService: ArtifactUploadQueueService;
    resultProcessorService: ResultProcessorService;
    daemonJobReporterService: DaemonJobReporterService;
}): AnalysisWorker => {
    const pluginBinaryCacheService = createPluginBinaryCacheService(deps.objectStore);
    const binaryExecutorService = createBinaryExecutorService();

    return new AnalysisWorker(
        deps.queueService,
        deps.analysisExecutionDataStore,
        deps.objectStore,
        pluginBinaryCacheService,
        binaryExecutorService,
        deps.artifactUploadQueueService,
        deps.resultProcessorService,
        deps.daemonJobReporterService
    );
};

export { createJobControlService };
