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
import { dislocationAnalysis, DislocationAnalysisModifierError } from '@/modifiers/dislocation-analysis';
import { computeMissorientationDeltas, computeMissorientationAngle } from '@/modifiers/missorientation';

export const crystalAnalysis = async (req: Request, res: Response) => {
    try {
        const { folderId, _id: trajectoryId, team, name, frames } = res.locals.trajectory;
        const analysisConfig = req.body;
        console.log('Analysis Config for', name, ' is ', analysisConfig);
        const result = await dislocationAnalysis({
            folderId,
            trajectoryId,
            team,
            name,
            frames,
            analysisConfig
        });

        switch(result){
            case DislocationAnalysisModifierError.TrajectoryFolderNotFound:
                return res.status(404).json({ error: 'Trajectory folder not found' });

            case DislocationAnalysisModifierError.TrajectoryFolderIsEmpty:
                return res.status(400).json({ error: 'No trajectory files found' });

            case DislocationAnalysisModifierError.MetadataParseError:
                return res.status(400).json({ error: 'Failed to read or parse metadata.json' });
        }

        return res.status(202).json({
            status: 'success',
            data: {
                trajectoryId,
                jobIds: result.jobsToEnqueue.map(j => j.jobId), 
                queueStatus: result.queueStatus
            }
        });
    }catch(error){
        res.status(500).json({
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
    }
};

export const getMissorientationDeltas = async (req: Request, res: Response) => {
    try{
        const { _id: trajectoryId, folderId, frames } = res.locals.trajectory;
        const theta0Frame = req.query?.theta0Frame;
        const frame = req.query?.frame;

    }catch(error){  
        res.status(500).json({
            status: 'error',
            data: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
    }
};