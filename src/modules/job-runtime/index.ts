import { AnalysisDispatchService, AnalysisWorker, createBinaryExecutorService, createPluginBinaryCacheService, createJobControlService } from './services';
import type { ResultProcessorService } from '@/modules/artifacts/services';
import type { WorkflowEngine } from '@/modules/workflow-runtime/services';
import type { RuntimeEventBroker } from '@/shared/services';
import type { MinioService, QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { DaemonJobReporterService } from '@/modules/cloud-control/services';

export interface JobRuntimeModule {
    analysisDispatchService: AnalysisDispatchService;
}

export const createJobRuntimeModule = (deps: {
    workflowEngine: WorkflowEngine;
    queueService: QueueService;
    redisConnectionService: RedisConnectionService;
    eventBroker: RuntimeEventBroker;
}): JobRuntimeModule => {
    const analysisDispatchService = new AnalysisDispatchService(
        deps.workflowEngine,
        deps.queueService,
        deps.redisConnectionService,
        deps.eventBroker
    );

    return {
        analysisDispatchService
    };
};

export const createAnalysisWorker = (deps: {
    queueService: QueueService;
    redisConnectionService: RedisConnectionService;
    minioService: MinioService;
    resultProcessorService: ResultProcessorService;
    daemonJobReporterService: DaemonJobReporterService;
}): AnalysisWorker => {
    const pluginBinaryCacheService = createPluginBinaryCacheService(deps.minioService);
    const binaryExecutorService = createBinaryExecutorService();

    return new AnalysisWorker(
        deps.queueService,
        deps.redisConnectionService,
        deps.minioService,
        pluginBinaryCacheService,
        binaryExecutorService,
        deps.resultProcessorService,
        deps.daemonJobReporterService
    );
};

export { createJobControlService };
