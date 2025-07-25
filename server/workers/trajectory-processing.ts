import { extractTimestepInfo, isValidLammpsFile } from '@/utilities/lammps';
import { parentPort } from 'worker_threads';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import LAMMPSToGLTFExporter from '@/utilities/export/atoms';
import mongoConnector from '@/utilities/mongo-connector';
import Trajectory from '@/models/trajectory';
import '@config/env';

// TODO: Duplicated code
interface TrajectoryProcessingJob{
    jobId: string;
    trajectoryId: string;
    files: {
        type: 'Buffer', 
        data: number[], 
        frameData: any 
    }[],
    folderPath: string;
    gltfFolderPath: string;
}

const processJob = async (job: TrajectoryProcessingJob) => {
    console.log(`[Worker #${process.pid}] Received job ${job.jobId}. Starting processing...`);

    if(!job || !job.jobId){
        throw new Error('No job data received in message.');
    }

    // @ts-ignore
    job.files.forEach(async ({ file, frameData }) => {
        console.log(`[Worker #${process.pid}] Processing timestep ${frameData.timestep} for ${job.trajectoryId}.`)
        const filename = frameData.timestep.toString();
        const lammpsFilePath = join(job.folderPath, filename);
        const gltfFilePath = join(job.gltfFolderPath, `${filename}.gltf`);
        const content = Buffer.from(file.data).toString('utf-8');
        await writeFile(lammpsFilePath, content);

        const gltfExporter = new LAMMPSToGLTFExporter();
        gltfExporter.exportAtomsToGLTF(
            lammpsFilePath,
            gltfFilePath,
            extractTimestepInfo,
            { maxInstancesPerMesh: 10000 }
        );
    });

    await Trajectory.findByIdAndUpdate(job.trajectoryId, {
        status: 'ready'
    }).lean();

    parentPort?.postMessage({
        status: 'completed',
        jobId: job.jobId,
    });
    console.log(`[Worker #${process.pid}] Finished job ${job.trajectoryId} successfully.`);
};

const main = async () => {
    await mongoConnector();
    parentPort?.on('message', (message: { job: TrajectoryProcessingJob }) => {
        processJob(message.job);
    });
};

main();