import { parentPort, workerData } from 'worker_threads';
import OpenDXAService from '@services/opendxa';
import mongoConnector from '@utilities/mongoConnector';
import '@config/env';

// TODO: Duplicated code
interface AnalysisJob{
    trajectoryId: string;
    folderPath: string;
    // TODO: any?
    config: any;
    trajectoryFiles: string[];
}

const main = async () => {
    await mongoConnector();
    
    const { job } = workerData as { job: AnalysisJob };
    if(!job){
        throw new Error('[Worker / Analysis]: No job data received.');
    }

    try{
        parentPort?.postMessage({
            status: 'running', 
            trajectoryId: job.trajectoryId 
        });

        const analysis = new OpenDXAService(job.trajectoryId, job.folderPath);
        const results = await analysis.analyzeTrajectory(job.trajectoryFiles, job.config);

        parentPort?.postMessage({
            status: 'completed',
            trajectoryId: job.trajectoryId,
            result: results
        });
    }catch(err: any){
        console.error(`[Worker] An error occurred while processing the trajectory ${job.trajectoryId}:`, err);
        parentPort?.postMessage({ status: 'failed', trajectoryId: job.trajectoryId, error: err.message });
    }
};

main();