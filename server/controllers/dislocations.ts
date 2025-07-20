import { Request, Response } from 'express';
import { readdir, writeFile, readFile } from 'fs/promises';
import { getAnalysisProcessingQueue } from '@services/analysis_queue';
import { existsSync } from 'fs';
import { join } from 'path';
import HandlerFactory from '@models/handlerFactory';

export const getTrajectoryDislocations = async (req: Request, res: Response) => {
    try {
        const { trajectoryId } = req.params;
        const folderPath = join(process.env.TRAJECTORY_DIR as string, trajectoryId);
        const analysisPath = join(process.env.ANALYSIS_DIR as string, trajectoryId);

        if(!existsSync(folderPath)){
            return res.status(404).json({ error: 'Trajectory folder not found' });
        }

        const files = await readdir(folderPath);
        const trajectoryFiles = files
            .filter((file) => /^\d+$/.test(file))
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map((file) => join(folderPath, file));

        if(trajectoryFiles.length === 0){
            return res.status(400).json({ error: 'No trajectory files found' });
        }
        
        const metadataPath = join(folderPath, 'metadata.json');
        let metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
        metadata.lastAnalysis = {
            jobId: `simple-queue-${Date.now()}`,
            config: req.body,
            status: 'queued',
            updatedAt: new Date().toISOString()
        };
        await writeFile(metadataPath, JSON.stringify(metadata, null, 4), 'utf-8');
        
        const queueService = getAnalysisProcessingQueue();
        queueService.addJob({
            trajectoryId,
            folderPath,
            analysisPath,
            config: req.body,
            trajectoryFiles
        });

        const queueStatus = await queueService.getStatus(); 
        return res.status(202).json({
            status: 'success',
            data: {
                trajectoryId,
                mode: 'queued',
                queueStatus
            }
        });
    }catch(error){
        res.status(500).json({
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
    }
};