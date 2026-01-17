import "reflect-metadata";
import BaseWorker from '@/src/shared/infrastructure/workers/BaseWorker';
import logger from '@/src/shared/infrastructure/logger';
import TrajectoryDumpStorageService from '../services/TrajectoryDumpStorageService';
import AtomisticExporter from '../services/exporters/AtomisticExporter';
import { container } from 'tsyringe';
import { performance } from 'node:perf_hooks';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import Job from '@/src/modules/jobs/domain/entities/Job';
import { registerDependencies } from '@/src/core/di';

export interface TrajectoryProcessingJobMetadata {
    trajectoryId: string;
    timestep: number;
}

export default class TrajectoryProcessingWorker extends BaseWorker<Job> {
    private dumpStorage!: TrajectoryDumpStorageService;
    private atomisticExporter!: AtomisticExporter;

    protected async setup(): Promise<void> {
        registerDependencies();
        await this.connectDB();
        this.dumpStorage = container.resolve(TrajectoryDumpStorageService);
        this.atomisticExporter = container.resolve(AtomisticExporter);
    }

    protected async perform(job: Job): Promise<void> {
        const metadata = job.props.metadata as TrajectoryProcessingJobMetadata;
        const { trajectoryId, timestep } = metadata;
        const { jobId } = job.props;

        const start = performance.now();

        logger.info(`@trajectory-processing-worker - #${process.pid}] start job ${jobId} | frame ${timestep}`);

        try {
            logger.debug(`@trajectory-processing-worker - #${process.pid}] Fetching dump for trajectory ${trajectoryId}, timestep ${timestep}`);
            const localDumpPath = await this.dumpStorage.getDump(trajectoryId, String(timestep));

            if (!localDumpPath) {
                logger.error(`@trajectory-processing-worker - #${process.pid}] Dump not found for trajectory ${trajectoryId}, timestep ${timestep}`);
                throw new Error(ErrorCodes.TRAJECTORY_DUMP_NOT_FOUND);
            }
            logger.debug(`@trajectory-processing-worker - #${process.pid}] Found dump at ${localDumpPath}`);

            // Generate GLB object name (not dump object name)
            const targetObjectName = `trajectory-${trajectoryId}/timestep-${timestep}.glb`;
            logger.debug(`@trajectory-processing-worker - #${process.pid}] Exporting to storage object: ${targetObjectName}`);

            await this.atomisticExporter.toStorage(localDumpPath, targetObjectName);
            logger.debug(`@trajectory-processing-worker - #${process.pid}] Export completed successfully`);

            const totalTime = (performance.now() - start).toFixed(2);
            logger.info(`@trajectory-processing-worker - #${process.pid}] job ${jobId} success | duration: ${totalTime}ms`);

            this.sendMessage({
                status: 'completed',
                jobId,
                timestep,
                duration: totalTime
            });
        } catch (error: any) {
            logger.error(`@trajectory-processing-worker - #${process.pid}] error processing job ${jobId}: ${error.message} \nStack: ${error.stack}`);
            this.sendMessage({
                status: 'failed',
                jobId,
                timestep,
                error: error.message
            });
        }
    }
};

BaseWorker.start(TrajectoryProcessingWorker);