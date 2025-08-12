import { join, basename } from 'path';
import { existsSync } from 'fs';
import { getAnalysisQueue } from '@/queues';
import { v4 } from 'uuid';
import fs from 'fs/promises';
import AnalysisConfig from '@/models/analysis-config';

export interface DislocationAnalysisModifierConfig{
    folderId: string;
    team: string;
    name: string;
    trajectoryId: string;
    frames: any[],
    analysisConfig: any
};

export enum DislocationAnalysisModifierError{
    TrajectoryFolderNotFound = 0,
    TrajectoryFolderIsEmpty = 1,
    MetadataParseError = 2
}

// TODO: I think that it's better create a BaseModifier class.
export const dislocationAnalysis = async (config: DislocationAnalysisModifierConfig) => {
    const folderPath = join(process.env.TRAJECTORY_DIR as string, config.folderId);
    if(!existsSync(folderPath)){
        return DislocationAnalysisModifierError.TrajectoryFolderNotFound;
    }
    const analysisConfig = await AnalysisConfig.create({
        trajectory: config.trajectoryId,
        ...config.analysisConfig
    });

    const files = await fs.readdir(folderPath);
    const trajectoryFiles = files
        .filter((file) => /^\d+$/.test(file))
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((file) => join(folderPath, file));

    if(trajectoryFiles.length === 0){
        return DislocationAnalysisModifierError.TrajectoryFolderIsEmpty;
    }

    const metadataPath = join(folderPath, 'metadata.json');

    let metadata: any = {};

    if(existsSync(metadataPath)){
        try{
            const content = await fs.readFile(metadataPath, 'utf-8');
            metadata = JSON.parse(content);
        }catch(error){
            return DislocationAnalysisModifierError.MetadataParseError;
        }
    }else{
        metadata = {};
    }

    metadata.lastAnalysis = {
        jobId: `queue-${Date.now()}`,
        config: config.analysisConfig,
        status: 'queued',
        updatedAt: new Date().toISOString()
    };

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 4), 'utf-8');

    const queueService = getAnalysisQueue();
    const jobsToEnqueue = trajectoryFiles.map((inputFile) => {
        const jobId = v4();
        return {
            jobId,
            trajectoryId: config.trajectoryId,
            analysisConfigId: analysisConfig._id,
            folderPath,
            inputFile,
            teamId: config.team,
            name: `Dislocation Analysis - Frame ${basename(inputFile)}/${config.frames[trajectoryFiles.length - 1].timestep}`,
            message: config.name,
            config: config.analysisConfig
        };
    });

    if(jobsToEnqueue.length > 0){
        await queueService.addJobs(jobsToEnqueue);
    }

    const queueStatus = await queueService.getStatus();

    return {
        queueStatus,
        jobsToEnqueue
    };
};