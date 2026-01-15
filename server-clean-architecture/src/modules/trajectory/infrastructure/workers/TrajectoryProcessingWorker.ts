import BaseWorker from '@/src/shared/infrastructure/workers/BaseWorker';
import logger from '@/src/shared/infrastructure/logger';
import TrajectoryDumpStorageService from '../services/TrajectoryDumpStorageService';
import AtomisticExporter from '../services/exporters/AtomisticExporter';
import { container } from 'tsyringe';
import { performance } from 'node:perf_hooks';
import { ErrorCodes } from '@/src/core/constants/error-codes';

export interface TrajectoryProcessingJob{
    jobId: string;
    trajectoryId: string;
    timestep: number;
    teamId: string;
};

export default class TrajectoryProcessingWorker extends BaseWorker<TrajectoryProcessingJob>{
    private dumpStorage!: TrajectoryDumpStorageService;
    private atomisticExporter!: AtomisticExporter;

    protected async setup(): Promise<void>{
        await this.connectDB();
        this.dumpStorage = container.resolve(TrajectoryDumpStorageService);
        this.atomisticExporter = container.resolve(AtomisticExporter);
    }

    protected async perform(job: TrajectoryProcessingJob): Promise<void>{
        const { trajectoryId, timestep, jobId } = job;
        const start = performance.now();

        logger.info(`@trajectory-processing-worker - #${process.pid}] start job ${job.jobId} | frame ${timestep}`);

        try{
            const localDumpPath = await this.dumpStorage.getDump(trajectoryId, String(timestep));
            if(!localDumpPath) throw new Error(ErrorCodes.TRAJECTORY_DUMP_NOT_FOUND);
            
            const targetObjectName = this.dumpStorage.getObjectName(trajectoryId, String(timestep));
            await this.atomisticExporter.toStorage(localDumpPath, targetObjectName);

            const totalTime = (performance.now() - start).toFixed(2);
            logger.info(`@trajectory-processing-worker - #${process.pid}] job ${job.jobId} success | duration: ${totalTime}ms`);

            this.sendMessage({
                status: 'completed',
                jobId,
                timestep,
                duration: totalTime
            });
        }catch(error: any){
            logger.error(`@trajectory-processing-worker - #${process.pid}] error processing job ${job.jobId}: ${error.message}`);
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