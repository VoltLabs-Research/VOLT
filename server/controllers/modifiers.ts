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
import { computeAnalysisStats } from '@/modifiers/analysis-stats';
import { getGLBPath } from '@/utilities/trajectory-glbs';
import DislocationExporter from '@/utilities/export/dislocations';

export const dislocationRenderOptions = async (req: Request, res: Response) => {
    const { folderId, _id } = res.locals.trajectory;
    const { timestep, analysisConfigId } = req.params;

    // TODO: verify trajectory analysis ownership

    const options = req.body;
    const exporter = new DislocationExporter();
    const glbFilePath = await getGLBPath(Number(timestep), 'dislocations', analysisConfigId, folderId);
    if(!glbFilePath){
        return res.status(404).json({
            status: 'error',
            data: { error: `GLB file for timestep ${timestep} not found` }
        });
    }
    console.log('glb file path:', glbFilePath)
    await exporter.rebuildGLBFromDB(String(analysisConfigId), Number(timestep), String(_id), glbFilePath, options)
    res.status(200).json({
        status: 'success',
        data: {}
    })
};

export const getAnalysisStats = async (req: Request, res: Response) => {
    const { _id } = res.locals.trajectory;
    const stats = await computeAnalysisStats(_id);
    
    res.status(200).json({ status: 'success', data: stats });
};

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
