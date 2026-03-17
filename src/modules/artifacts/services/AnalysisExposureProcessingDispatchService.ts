import { ANALYSIS_EXPOSURE_PROCESSING_QUEUE_NAME } from '@/modules/platform/services';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { AnalysisExposureDefinition, AnalysisJobExecutionData } from '@/shared/contracts';

export interface AnalysisExposureProcessingJobPayload extends Record<string, unknown> {
    jobId: string;
    parentJobId: string;
    name: string;
    teamId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    queueType: string;
    createdAt: string;
    updatedAt: string;
    timestamp?: string;
    error?: string;
    metadata: {
        analysisId: string;
        exposureId: string;
        exposureName: string;
        parentJobId: string;
        timestep: number;
        trajectoryId: string;
    };
    executionData: AnalysisJobExecutionData;
    exposure: AnalysisExposureDefinition;
    outputDir: string;
    timestep: number;
};

export interface AnalysisExposureProcessingDispatchInput {
    executionData: AnalysisJobExecutionData;
    parentJobId: string;
    outputDir: string;
    teamId: string;
    timestep: number;
};

export class AnalysisExposureProcessingDispatchService {
    constructor(
        private readonly queueService: QueueService,
        private readonly redisConnectionService: RedisConnectionService
    ) {
    }

    async dispatchExposureJobs(input: AnalysisExposureProcessingDispatchInput): Promise<AnalysisExposureProcessingJobPayload[]> {
        const timestamp = new Date().toISOString();
        const jobs = input.executionData.exposures.map((exposure) => ({
            jobId: `${input.parentJobId}:exposure:${exposure.nodeId}:${input.timestep}`,
            parentJobId: input.parentJobId,
            name: exposure.name,
            teamId: input.teamId,
            status: 'queued' as const,
            queueType: ANALYSIS_EXPOSURE_PROCESSING_QUEUE_NAME,
            createdAt: timestamp,
            updatedAt: timestamp,
            metadata: {
                analysisId: input.executionData.analysisId,
                exposureId: exposure.nodeId,
                exposureName: exposure.name,
                parentJobId: input.parentJobId,
                timestep: input.timestep,
                trajectoryId: input.executionData.trajectoryId
            },
            executionData: input.executionData,
            exposure,
            outputDir: input.outputDir,
            timestep: input.timestep
        }));

        const result = await this.queueService.enqueueMany(ANALYSIS_EXPOSURE_PROCESSING_QUEUE_NAME, jobs, {
            preserveExistingJob: true
        });

        await Promise.all(result.enqueuedPayloads.map((job) => this.redisConnectionService.projectJobStatus(job)));

        return jobs;
    }
}
