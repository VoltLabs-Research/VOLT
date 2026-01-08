
import { BaseWorker } from './base-worker';
import { TrajectoryProcessingJob } from '@/types/queues/trajectory-processing-queue';
import { performance } from 'node:perf_hooks';
import logger from '@/logger';
import AtomisticExporter from '@/utilities/export/atoms';
import DumpStorage from '@/services/trajectory/dump-storage';

class TrajectoryProcessingWorker extends BaseWorker<TrajectoryProcessingJob> {
    private exporter = new AtomisticExporter();

    protected async perform(job: TrajectoryProcessingJob): Promise<void> {
        if (!job?.jobId) throw new Error('MissingJobId');

        const { trajectoryId, timestep } = job;
        const start = performance.now();

        logger.info(`[Worker #${process.pid}] Start Job ${job.jobId} | Frame ${timestep}`);

        const localDumpPath = await DumpStorage.getDump(trajectoryId, timestep);
        if (!localDumpPath) throw new Error('Dump not found');

        const targetObjectName = `trajectory-${trajectoryId}/previews/timestep-${timestep}.glb`;
        await this.exporter.toGLBMinIO(localDumpPath, targetObjectName);

        const totalTime = (performance.now() - start).toFixed(2);
        logger.info(`[Worker #${process.pid}] Job ${job.jobId} Success | Duration: ${totalTime}ms`);

        this.sendMessage({
            status: 'completed',
            jobId: job.jobId,
            timestep,
            duration: totalTime
        });
    }
}

BaseWorker.start(TrajectoryProcessingWorker);
