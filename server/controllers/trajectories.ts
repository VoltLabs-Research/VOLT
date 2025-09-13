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
import { basename, join, resolve } from 'path';
import { access, stat, mkdir, rm, writeFile, constants, readFile, readdir } from 'fs/promises';
import { copyFile, listGlbFiles } from '@/utilities/fs';
import { isValidObjectId } from 'mongoose';
import { getRasterizerQueue, getTrajectoryProcessingQueue } from '@/queues';
import { processTrajectoryFile } from '@/utilities/lammps';
import { v4 } from 'uuid';
import { getGLBPath } from '@/utilities/trajectory-glbs';
import { Trajectory, Team } from '@models/index';
import HandlerFactory from '@/controllers/handler-factory';
import RuntimeError from '@/utilities/runtime-error';
import { getMetricsByTeamId } from '@/metrics/team';
import { catchAsync } from '@/utilities/runtime';
import { HeadlessRasterizerOptions } from '@/services/headless-rasterizer';
import { RasterizerJob } from '@/types/services/rasterizer-queue';

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
    const { teamId } = req.query;
    const teamMetrics = await getMetricsByTeamId(teamId as string);

    return res.status(200).json({
        status: 'success',
        data: teamMetrics
    });
};

export const getTrajectoryRasterizedFrames = catchAsync(async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    if(!trajectory){
        return res.status(400).json({
            status: 'error',
            data: { error: 'Trajectory not found in context' },
        });
    }

    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const rasterDir = join(basePath, trajectory.folderId, 'raster');

    try{
        await access(rasterDir, constants.F_OK);
    }catch{
        return res.status(200).json({
            status: 'success',
            data: {
                trajectory,
                items: [],
                meta: {
                    total: 0,
                }
            }
        });
    }

    const allFiles = await readdir(rasterDir);
    let pngs = allFiles.filter(f => f.toLowerCase().endsWith('.png'));
    const pngSet = new Set(pngs.map(f => f.toLowerCase()));

    const parseFrame = (name: string): number | null => {
        const withoutExt = name.replace(/\.(png|glb)$/i, '');
        const m1 = withoutExt.match(/frame[-_](\d+)(?:[_-]|$)/i);
        if (m1) return parseInt(m1[1], 10);
        const m2 = withoutExt.match(/^(\d+)$/);
        if (m2) return parseInt(m2[1], 10);
        const m3 = withoutExt.match(/(?:^|_)t(?:imestep)?_?(\d+)(?:[_-]|$)/i);
        if (m3) return parseInt(m3[1], 10);
        return null;
    };

    pngs.sort((a, b) => {
        const fa = parseFrame(a);
        const fb = parseFrame(b);
        if (fa !== null && fb !== null) return fa - fb;
        if (fa !== null) return -1;
        if (fb !== null) return 1;
        return a.localeCompare(b, undefined, { numeric: true });
    });

    const total = pngs.length;

    const items: any[] = [];
    let maxMtime = 0;

    for (const filename of pngs){
        const abs = join(rasterDir, filename);
        const st = await stat(abs);
        const frame = parseFrame(filename);
        const item: any = {
            frame,
            filename,
            url: `/trajectories/${trajectory._id}/files/raster/${filename}`,
            mime: 'image/png',
            size: st.size,
            mtime: st.mtime.getTime(),
        };
        
        const buf = await readFile(abs);
        item.data = `data:image/png;base64,${buf.toString('base64')}`;
        
        items.push(item);
        if (st.mtime.getTime() > maxMtime) {
            maxMtime = st.mtime.getTime();
        }
    }

    const glbDir = join(basePath, trajectory.folderId, 'glb');
    const byFrame: Record<number, Array<{
        type: 'atoms_colored_by_type' | 'dislocations' | 'interface_mesh' | 'defect_mesh';
        frame: number;
        filename: string;
        url: string;
        mime: string;
        size: number;
        mtime: number;
        data?: string;
    }>> = {};
    
    const typeOrder: Record<string, number> = {
        defect_mesh: 0,
        interface_mesh: 1,
        dislocations: 2,
        atoms_colored_by_type: 3
    };
    
    const parseType = (name: string) => {
        const s = name.toLowerCase();
        if (s.includes('atoms_colored_by_type')) return 'atoms_colored_by_type' as const;
        if (s.includes('dislocations')) return 'dislocations' as const;
        if (s.includes('interface_mesh')) return 'interface_mesh' as const;
        if (s.includes('defect_mesh')) return 'defect_mesh' as const;
        return null;
    };
    
    const resolvePngForGlb = (glbName: string, frame: number | null): string | null => {
        const primary = glbName.replace(/\.glb$/i, '.png');
        if (pngSet.has(primary.toLowerCase())) return primary;
        const c1 = `frame-${frame}.png`;
        const c2 = `frame_${frame}.png`;
        const c3 = `${frame}.png`;
        const c4 = `timestep_${frame}.png`;
        if (frame !== null){
            if (pngSet.has(c1.toLowerCase())) return c1;
            if (pngSet.has(c2.toLowerCase())) return c2;
            if (pngSet.has(c3.toLowerCase())) return c3;
            if (pngSet.has(c4.toLowerCase())) return c4;
        }
        return null;
    };

    try{
        await access(glbDir, constants.F_OK);
        const allGlb = await readdir(glbDir);
        const glbs = allGlb.filter(f => f.toLowerCase().endsWith('.glb'));
        
        for (const glbFilename of glbs){
            const frame = parseFrame(glbFilename);
            const t = parseType(glbFilename);
            if (!t || frame === null) continue;
            
            const pngName = resolvePngForGlb(glbFilename, frame);
            if (!pngName) continue;
            
            const pngAbs = join(rasterDir, pngName);
            try {
                const st = await stat(pngAbs);
                const it: any = {
                    type: t,
                    frame,
                    filename: pngName,
                    url: `/trajectories/${trajectory._id}/files/raster/${pngName}`,
                    mime: 'image/png',
                    size: st.size,
                    mtime: st.mtime.getTime()
                };
                
                const buf = await readFile(pngAbs);
                it.data = `data:image/png;base64,${buf.toString('base64')}`;
                
                (byFrame[frame] ||= []).push(it);
                if (it.mtime > maxMtime) maxMtime = it.mtime;
            } catch (error) {
                continue;
            }
        }
    }catch{}

    const frames = Object.keys(byFrame).map(Number).sort((a,b)=>a-b);
    for (const f of frames){
        byFrame[f].sort((a,b) => {
            const ta = typeOrder[a.type] ?? 999;
            const tb = typeOrder[b.type] ?? 999;
            if (ta !== tb) return ta - tb;
            if (a.filename !== b.filename) return a.filename.localeCompare(b.filename, undefined, { numeric: true });
            return a.size - b.size;
        });
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', `"raster-${trajectory._id}-${total}-${maxMtime}"`);

    return res.status(200).json({
        status: 'success',
        data: {
            trajectory,
            items,
            byFrame,
            meta: {
                total,
                returned: items.length
            }
        }
    });
});

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

export const rasterizeFrames = catchAsync(async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const glbDir = join(basePath, trajectory.folderId, 'glb');
    const outputDir = join(basePath, trajectory.folderId, 'raster');
    const glbs = listGlbFiles(glbDir);
    const customOpts: Partial<HeadlessRasterizerOptions> = req.body;

    const jobs: RasterizerJob[] = (await glbs).map((glbPath) => {
        const frame = basename(glbPath).replace(/\.[^.]+$/i, '');
        const outPath = join(outputDir, `${frame}.png`);
        const opts: Partial<HeadlessRasterizerOptions> = {
            inputPath: glbPath,
            outputPath: outPath,
            ...customOpts
        };

        const job = {
            opts,
            jobId: v4(),
            trajectoryId: trajectory._id,
            teamId: trajectory.team._id,
            name: 'Headless Rasterizer',
            message: `${trajectory.name} - Frame ${frame}`
        };

        return job;
    });

    const queueService= getRasterizerQueue();
    queueService.addJobs(jobs);
    
    res.status(200).json({ status: 'success' });
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

    let files: string[] = await listGlbFiles(glbDir);

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

    const glbFilePath = await getGLBPath(timestep, type as string, analysisId, trajectory.folderId);
    if(!glbFilePath){
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

    const startTime = performance.now();

    const filePromises = files.map(async (file: any, i: number) => {
        try {
            console.log(`Processing file ${i + 1}/${files.length}: ${file.originalname || 'unnamed'} (${file.size} bytes)`);

            const tempFilePath = join(folderPath, `temp_${i}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
            await writeFile(tempFilePath, file.buffer);

            const tempStats = await stat(tempFilePath);
            console.log(`Temp file written: ${tempStats.size} bytes`);

            if(tempStats.size !== file.size){
                console.error(`Temp file size mismatch: expected ${file.size}, got ${tempStats.size}`);
                await rm(tempFilePath).catch(console.error);
                return null;
            }

            try{
                const { frameInfo, isValid } = await processTrajectoryFile(tempFilePath, tempFilePath);
                if(!frameInfo || !isValid){
                    console.log(`File ${i} is not valid, skipping...`);
                    await rm(tempFilePath).catch(console.error);
                    return null;
                }

                const frameFilePath = join(folderPath, `${frameInfo.timestep}`);
                await rm(frameFilePath).catch(() => {});
                await copyFile(tempFilePath, frameFilePath);
                await rm(tempFilePath).catch(console.error);

                const frameData = {
                    ...frameInfo,
                    glbPath: `glb/${frameInfo.timestep}.glb`
                };

                console.log(`File ${i} processed successfully (timestep: ${frameInfo.timestep})`);

                return {
                    frameData,
                    frameFilePath,
                    originalSize: file.size
                };

            }catch(processError){
                console.error(`Error processing file ${i}:`, processError);
                await rm(tempFilePath).catch(console.error);
                return null;
            }
        }catch(err){
            console.error(`Error processing file ${i}:`, err);
            return null;
        } finally {
            // Clean up references for GC
            file.buffer = null;
            files[i] = null;
        }
    });

    const results = await Promise.all(filePromises);
    const validFiles = results.filter(result => result !== null);
    const processingTime = performance.now() - startTime;

    if(validFiles.length === 0){
        await rm(folderPath, { recursive: true });
        return next(new RuntimeError('No valid files for trajectory', 400));
    }

    const totalSize = validFiles.reduce((acc, file) => acc + file.originalSize, 0);
    const frames = validFiles.map(file => file.frameData);

    const trajectoryName = req.body.originalFolderName || 'Untitled Trajectory';
    const newTrajectory = await Trajectory.create({
        folderId,
        name: trajectoryName,
        team: teamId,
        frames,
        status: 'processing',
        stats: {
            totalFiles: validFiles.length,
            totalSize,
            processingTime: Math.round(processingTime)
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
        data: newTrajectory,
    });
};