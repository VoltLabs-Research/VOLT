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

import { NextFunction, Request, Response } from 'express';
import { join, resolve } from 'path';
import { access, stat, readdir, mkdir, rm, writeFile, constants } from 'fs/promises';
import { copyFile } from '@/utilities/fs';
import { isValidObjectId } from 'mongoose';
import { getTrajectoryProcessingQueue } from '@/queues';
import { processTrajectoryFile } from '@/utilities/lammps';
import { v4 } from 'uuid';
import Trajectory from '@models/trajectory';
import Team from '@models/team';
import HandlerFactory from '@/controllers/handler-factory';
import RuntimeError from '@/utilities/runtime-error';
import StructureAnalysis from '@models/structure-analysis';
import Dislocation from '@models/dislocations';

const factory = new HandlerFactory({
    model: Trajectory,
    fields: ['name', 'preview'],
    errorMessages: {
        default: {
            notFound: 'Trajectory::NotFound',
            unauthorized: 'Trajectory::AccessDenied',
            validation: 'Trajectory::ValidationError'
        }
    },
    defaultErrorConfig: 'default'
});

export const getTrajectoryById = factory.getOne();
export const updateTrajectoryById = factory.updateOne();

export const getTrajectoryMetrics = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { teamId } = req.query;
    const now = new Date();
    const tz = process.env.TZ || 'UTC';
    const weeks = 12;

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const teamQuery: any = { members: userId };
    if(teamId && typeof teamId === 'string'){
        teamQuery._id = teamId;
    }
    const teams = await Team.find(teamQuery).select('_id');
    const teamIds = teams.map(t => t._id);

    if(teamIds.length === 0){
        return res.status(200).json({
            status: 'success',
            data: {
                totals: { structureAnalysis: 0, trajectories: 0, dislocations: 0 },
                lastMonth: { structureAnalysis: 0, trajectories: 0, dislocations: 0 },
                weekly: { labels: [], structureAnalysis: [], trajectories: [], dislocations: [] }
            }
        });
    }

    const trajectories = await Trajectory.find({ team: { $in: teamIds } }).select('_id createdAt');
    const trajectoryIds = trajectories.map(t => t._id);

    const totals = await Promise.all([
        Trajectory.countDocuments({ team: { $in: teamIds } }),
        StructureAnalysis.countDocuments({ trajectory: { $in: trajectoryIds } }),
        Dislocation.aggregate([
            { $match: { trajectory: { $in: trajectoryIds } } },
            { $group: { _id: null, total: { $sum: '$totalSegments' } } }
        ])
    ]);
    const totalTraj = totals[0] || 0;
    const totalStruct = totals[1] || 0;
    const totalDisl = (totals[2][0]?.total as number) || 0;

    const [trajCurr, trajPrev] = await Promise.all([
        Trajectory.countDocuments({ team: { $in: teamIds }, createdAt: { $gte: monthStart, $lt: now } }),
        Trajectory.countDocuments({ team: { $in: teamIds }, createdAt: { $gte: prevMonthStart, $lt: monthStart } })
    ]);
    const [structCurr, structPrev] = await Promise.all([
        StructureAnalysis.countDocuments({ trajectory: { $in: trajectoryIds }, createdAt: { $gte: monthStart, $lt: now } }),
        StructureAnalysis.countDocuments({ trajectory: { $in: trajectoryIds }, createdAt: { $gte: prevMonthStart, $lt: monthStart } })
    ]);
    const dislCurrAgg = await Dislocation.aggregate([
        { $match: { trajectory: { $in: trajectoryIds }, createdAt: { $gte: monthStart, $lt: now } } },
        { $group: { _id: null, total: { $sum: '$totalSegments' } } }
    ]);
    const dislPrevAgg = await Dislocation.aggregate([
        { $match: { trajectory: { $in: trajectoryIds }, createdAt: { $gte: prevMonthStart, $lt: monthStart } } },
        { $group: { _id: null, total: { $sum: '$totalSegments' } } }
    ]);
    const dislCurr = (dislCurrAgg[0]?.total as number) || 0;
    const dislPrev = (dislPrevAgg[0]?.total as number) || 0;

    const pct = (c: number, p: number) => p === 0 ? (c > 0 ? 100 : 0) : Math.round(((c - p) / p) * 100);
    const lastMonth = {
        trajectories: pct(trajCurr, trajPrev),
        structureAnalysis: pct(structCurr, structPrev),
        dislocations: pct(dislCurr, dislPrev)
    };

    const sinceDate = new Date(now);
    sinceDate.setUTCDate(sinceDate.getUTCDate() - (weeks * 7));
    sinceDate.setUTCHours(0, 0, 0, 0);

    const trajWeekly = await Trajectory.aggregate([
        { $match: { team: { $in: teamIds }, createdAt: { $gte: sinceDate } } },
        { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'week', timezone: tz } }, value: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    const structWeekly = await StructureAnalysis.aggregate([
        { $match: { trajectory: { $in: trajectoryIds }, createdAt: { $gte: sinceDate } } },
        { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'week', timezone: tz } }, value: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    const dislWeekly = await Dislocation.aggregate([
        { $match: { trajectory: { $in: trajectoryIds }, createdAt: { $gte: sinceDate } } },
        { $group: { _id: { $dateTrunc: { date: '$createdAt', unit: 'week', timezone: tz } }, value: { $sum: '$totalSegments' } } },
        { $sort: { _id: 1 } }
    ]);

    const key = (d: any) => new Date(d).toISOString().slice(0,10);
    const allKeys = new Set<string>();
    for (const r of trajWeekly) allKeys.add(key(r._id));
    for (const r of structWeekly) allKeys.add(key(r._id));
    for (const r of dislWeekly) allKeys.add(key(r._id));

    const sorted = Array.from(allKeys).sort();
    const clampLastN = sorted.slice(-weeks); 

    const toDict = (arr: Array<{ _id: Date; value: number }>) => {
        const m = new Map<string, number>();
        for (const r of arr) m.set(key(r._id), r.value);
        return m;
    };

    const dTraj = toDict(trajWeekly as any);
    const dStruct = toDict(structWeekly as any);
    const dDisl = toDict(dislWeekly as any);

    const seriesTraj = clampLastN.map((k) => dTraj.get(k) ?? 0);
    const seriesStruct = clampLastN.map((k) => dStruct.get(k) ?? 0);
    const seriesDisl = clampLastN.map((k) => dDisl.get(k) ?? 0);

    return res.status(200).json({
        status: 'success',
        data: {
            totals: {
                structureAnalysis: totalStruct,
                trajectories: totalTraj,
                dislocations: totalDisl
            },
            lastMonth,
            weekly: {
                labels: clampLastN,      
                trajectories: seriesTraj,
                structureAnalysis: seriesStruct,
                dislocations: seriesDisl
            }
        }
    });
};

export const deleteTrajectoryById = factory.deleteOne({
    beforeDelete: async (doc: any, req: Request) => {
        console.log(`Preparing to delete trajectory: ${doc.name} (ID: ${doc._id})`);
        
        const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
        const trajectoryPath = join(basePath, doc.folderId);
        
        try{
            // Clean up trajectory files
            await rm(trajectoryPath, { recursive: true, force: true });
            console.log(`Cleaned up trajectory files at: ${trajectoryPath}`);
        }catch(error){
            console.warn(`Warning: Could not clean up files for trajectory ${doc._id}:`, error);
        }
    }
});

export const getUserTrajectories = factory.getAll({
    customFilter: async (req: Request) => {
        const userId = (req as any).user.id;
        const { teamId } = req.query;
        
        let teamQuery: any = { members: userId };
        if(teamId && typeof teamId === 'string'){
            if(!isValidObjectId(teamId)){
                throw new Error(`Invalid teamId: ${teamId}`);
            }
            teamQuery._id = teamId;
        }

        const userTeams = await Team.find(teamQuery).select('_id');
        
        if(teamId && userTeams.length === 0){
            // Return empty filter that matches nothing
            return { _id: { $in: [] } };
        }
        
        const teamIds = userTeams.map(team => team._id);
        return { team: { $in: teamIds } };
    }
});

// TODO: change controller name
export const listTrajectoryGLBFiles = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;

    if(!trajectory){
        return res.status(400).json({
            status: 'error',
            data: { error: 'Trajectory not found in context' },
        });  
    }

    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const glbDir = join(basePath, trajectory.folderId, 'glb');

    let files: string[];
    try{
        files = await readdir(glbDir);
    }catch(err){
        return res.status(500).json({
            status: 'error',
            data: { error: 'Failed to read GLB directory' },
        });
    }

    const typeMap: Record<string, string | null> = {
        atoms_colored_by_type: null,
        dislocations: null,
        defect_mesh: null,
        interface_mesh: null
    };

    for(const file of files){
        const match = file.match(/^frame_\d+_([a-zA-Z0-9_]+)\.glb$/);
        if(match){
            const type= match[1];
            if(type in typeMap){
                typeMap[type] = join('glb', file);
            }
        }
    }

    return res.status(200).json({
        status: 'success',
        data: typeMap
    })
};

// TODO: public folder maybe?
export const getTrajectoryPreview = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;

    if(!trajectory || !trajectory.preview){
        return res.status(404).json({
            status: 'error',
            data: { error: 'Preview not found' }
        });
    }

    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const previewPath = join(basePath, trajectory.folderId, `${trajectory.preview}.png`);

    try{
        await access(previewPath, constants.F_OK);
    }catch(error){
        return res.status(404).json({
            status: 'error',
            data: { error: 'Preview file not found' }
        });
    }

    const fileStats = await stat(previewPath);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', fileStats.size);
    res.setHeader('Content-Disposition', `inline; filename="${trajectory.name}_preview.png"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', `"${trajectory.preview}-${fileStats.mtime.getTime()}"`);

    res.sendFile(previewPath);
};

export const getTrajectoryGLB = async (req: Request, res: Response) => {
    const { timestep, analysisId } = req.params;
    const { type } = req.query;
    const trajectory = res.locals.trajectory;

    const frame = trajectory.frames.find((frame: any) => frame.timestep.toString() === timestep);
    if(!frame){
        return res.status(404).json({
            status: 'error',
            data: { error: `Timestep ${timestep} not found in trajectory` }
        });
    }

    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const fileName = type
        ? `frame-${timestep}_${type}_analysis-${analysisId}.glb`
        : `${timestep}.glb`;

    const glbFilePath = join(basePath, trajectory.folderId, 'glb', fileName);

    try{
        await access(glbFilePath, constants.F_OK);
    }catch(error){
        return res.status(404).json({
            status: 'error',
            data: { error: `GLB file for timestep ${timestep} not found` }
        });
    }

    const fileStats = await stat(glbFilePath);
    res.setHeader('Content-Type', 'model/gltf+json');
    res.setHeader('Content-Length', fileStats.size);
    res.setHeader('Content-Disposition', `inline; filename="${trajectory.name}_${timestep}.glb"`);
    // res.setHeader('Cache-Control', 'public, max-age=86400'); 

    res.sendFile(glbFilePath);
};

export const createTrajectory = async (req: Request, res: Response, next: NextFunction) => {
    const { files, teamId } = res.locals.data;

    const folderId = v4();
    const folderPath = join(process.env.TRAJECTORY_DIR as string, folderId);
    const glbFolderPath = join(folderPath, 'glb');

    await mkdir(folderPath, { recursive: true });
    await mkdir(glbFolderPath, { recursive: true });

    const validFiles = [];
    const frames = [];

    for(let i = 0; i < files.length; i++){
        const file = files[i];
        
        try{
            console.log(`Processing file ${i + 1}/${files.length}: ${file.originalname || 'unnamed'} (${file.size} bytes)`);

            // Write file to disk first regardless of size
            const tempFilePath = join(folderPath, `temp_${i}_${Date.now()}`);
            await writeFile(tempFilePath, file.buffer);

            // Verify the temp file was written correctly
            const tempStats = await stat(tempFilePath);
            console.log(`Temp file written: ${tempStats.size} bytes`);

            if(tempStats.size !== file.size){
                console.error(`Temp file size mismatch: expected ${file.size}, got ${tempStats.size}`);
                await rm(tempFilePath).catch(console.error);
                continue;
            }

            try{
                const { frameInfo, isValid } = await processTrajectoryFile(tempFilePath, tempFilePath);
                if(!frameInfo || !isValid){
                    console.log(`File ${i} is not valid, skipping...`);
                    await rm(tempFilePath).catch(console.error);
                    continue;
                }

                const frameFilePath = join(folderPath, `${frameInfo.timestep}`);
                
                // Remove existing file if it exists
                await rm(frameFilePath).catch(() => {});

                await copyFile(tempFilePath, frameFilePath);

                // Clean up temp file
                await rm(tempFilePath).catch(console.error);

                const frameData = {
                    ...frameInfo,
                    glbPath: `glb/${frameInfo.timestep}.glb`
                };

                frames.push(frameData);
                validFiles.push({
                    frameData,
                    frameFilePath,
                    originalSize: file.size
                });

                console.log(`File ${i} processed successfully (timestep: ${frameInfo.timestep})`);
            }catch(processError){
                console.error(`Error processing file ${i}:`, processError);
                await rm(tempFilePath).catch(console.error);
                // Clean up references for GC
                file.buffer = null;
                files[i] = null;
                // Force GC every 5 files if available
                if(i % 5 === 0 && global.gc){
                    console.log(`Forcing garbage collection...`);
                    global.gc();
                }
            }
        }catch(err){
            console.error(`Error processing file ${i}:`, err);
            continue;
        }
    }

    if(validFiles.length === 0){
        await rm(folderPath, { recursive: true });
        return next(new RuntimeError('No valid files for trajectory', 400));
    }

    const totalSize = validFiles.reduce((acc, file) => acc + file.originalSize, 0);

    const trajectoryName = req.body.originalFolderName || 'Untitled Trajectory';
    const newTrajectory = await Trajectory.create({
        folderId,
        name: trajectoryName,
        team: teamId,
        frames,
        status: 'processing',
        stats: {
            totalFiles: validFiles.length,
            totalSize
        } 
    });

    const trajectoryProcessingQueue = getTrajectoryProcessingQueue();

    const CHUNK_SIZE = 20;
    const jobs = [];

    for(let i = 0; i < validFiles.length; i += CHUNK_SIZE){
        const chunk = validFiles.slice(i, i + CHUNK_SIZE);
        const job = {
            jobId: v4(),
            trajectoryId: newTrajectory._id.toString(),
            chunkIndex: Math.floor(i / CHUNK_SIZE),
            totalChunks: Math.ceil(validFiles.length / CHUNK_SIZE),
            files: chunk.map(({ frameData, frameFilePath }) => ({
                frameData,
                frameFilePath
            })),
            teamId,
            name: 'Upload Trajectory',
            message: trajectoryName,
            folderPath,
            glbFolderPath
        };
        jobs.push(job);
    }

    for(const job of jobs){
        await trajectoryProcessingQueue.addJobs([job]);
        // Short pause to avoid overloading
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    res.status(201).json({
        status: 'success',
        data: newTrajectory
    })
};