import { basename } from 'path';
import { getAnalysisQueue } from '@/queues';
import { v4 } from 'uuid';
import { AnalysisConfig } from '@/models/index';
import TrajectoryFS from '@/services/trajectory-fs';

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
    const trajFS = new TrajectoryFS(config.folderId);
    
    const analysisConfig = await AnalysisConfig.create({
        trajectory: config.trajectoryId,
        ...config.analysisConfig
    });

    // Get all dumps using TrajectoryFS
    const dumps = await trajFS.getDumps();
    const trajectoryFiles = Object.values(dumps);

    if(trajectoryFiles.length === 0){
        return DislocationAnalysisModifierError.TrajectoryFolderIsEmpty;
    }

    const queueService = getAnalysisQueue();
    const jobsToEnqueue = trajectoryFiles.map((inputFile) => {
        const jobId = v4();
        const frameNumber = basename(inputFile);
        return {
            jobId,
            trajectoryId: config.trajectoryId,
            analysisConfigId: String(analysisConfig._id),
            folderPath: trajFS.root,
            inputFile,
            teamId: config.team,
            name: `Dislocation Analysis - Frame ${frameNumber}/${config.frames[trajectoryFiles.length - 1].timestep}`,
            message: config.name,
            config: config.analysisConfig
        };
    });

    if(jobsToEnqueue.length > 0){
        await queueService.addJobs(jobsToEnqueue);
    }

    const queueStatus = null;

    return {
        queueStatus,
        jobsToEnqueue
    };
};