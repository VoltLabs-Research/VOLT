/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { Request, Response } from 'express';
import { readdir, writeFile, readFile } from 'fs/promises';
import { getAnalysisProcessingQueue } from '@services/analysis_queue';
import { existsSync } from 'fs';
import { join } from 'path';
import { v4 } from 'uuid';

export const getTrajectoryDislocations = async (req: Request, res: Response) => {
    try {
        const { folderId, _id: trajectoryId } = res.locals.trajectory;
        const folderPath = join(process.env.TRAJECTORY_DIR as string, folderId);

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

        let metadata: any = {};
        if(existsSync(metadataPath)){
            try{
                metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
            }catch(err){
                return res.status(400).json({ error: 'Failed to read or parse metadata.json' });
            }
        }else{
            metadata = {};
        }

        metadata.lastAnalysis = {
            jobId: `queue-${Date.now()}`,
            config: req.body,
            status: 'queued',
            updatedAt: new Date().toISOString()
        };
        await writeFile(metadataPath, JSON.stringify(metadata, null, 4), 'utf-8');
        
        const queueService = getAnalysisProcessingQueue();
        const jobsToEnqueue = trajectoryFiles.map((inputFile) => {
            const jobId = v4();
            return {
                jobId,
                trajectoryId,
                folderPath,
                inputFile,
                config: req.body
            };
        });

        if(jobsToEnqueue.length > 0){
            await queueService.addJobs(jobsToEnqueue);
        }

        const queueStatus = await queueService.getStatus(); 
        return res.status(202).json({
            status: 'success',
            data: {
                trajectoryId,
                jobIds: jobsToEnqueue.map(j => j.jobId), 
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