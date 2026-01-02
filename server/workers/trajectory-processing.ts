import { parentPort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { TrajectoryProcessingJob } from '@/types/queues/trajectory-processing-queue';
import logger from '@/logger';
import AtomisticExporter from '@/utilities/export/atoms';
import DumpStorage from '@/services/trajectory/dump-storage';
import '@config/env';

const exporter = new AtomisticExporter();

const processJob = async (job: TrajectoryProcessingJob) => {
    if (!job?.jobId) throw new Error('MissingJobId');

    const { file, trajectoryId, timestep } = job;
    const start = performance.now();

    logger.info(`[Worker #${process.pid}] Start Job ${job.jobId} | Frame ${timestep}`);

    try {
        const localDumpPath = await DumpStorage.getDump(trajectoryId, timestep);
        if (!localDumpPath) throw new Error('Dump not found');

        const targetObjectName = `trajectory-${trajectoryId}/previews/timestep-${timestep}.glb`;
        await exporter.toGLBMinIO(localDumpPath, targetObjectName);

        const totalTime = (performance.now() - start).toFixed(2);
        logger.info(`[Worker #${process.pid}] Job ${job.jobId} Success | Duration: ${totalTime}ms`);

        parentPort?.postMessage({
            status: 'completed',
            jobId: job.jobId,
            timestep,
            duration: totalTime
        });
    } catch (error) {
        logger.error(`[Worker #${process.pid}] Job ${job.jobId} Failed: ${error}`);
        parentPort?.postMessage({
            status: 'failed',
            jobId: job.jobId,
            timestep,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

const main = () => {
    logger.info(`[Worker #${process.pid}] Online`);

    parentPort?.on('message', async (message: { job: TrajectoryProcessingJob }) => {
        try {
            await processJob(message.job);
        } catch (error) {
            logger.error(`[Worker #${process.pid}] Fatal Exception: ${error}`);
            parentPort?.postMessage({
                status: 'failed',
                jobId: message.job?.jobId || 'unknown',
                error: 'Fatal worker exception'
            });
        }
    });
};

main();

