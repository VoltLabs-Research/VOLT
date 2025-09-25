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
import { access, stat, mkdir, rm, writeFile, constants } from 'fs/promises';
import { copyFile, listGlbFiles } from '@/utilities/fs';
import { isValidObjectId } from 'mongoose';
import { getTrajectoryProcessingQueue } from '@/queues';
import { processTrajectoryFile } from '@/utilities/lammps';
import { v4 } from 'uuid';
import { getGLBPath } from '@/utilities/trajectory-glbs';
import { Trajectory, Team } from '@models/index';
import HandlerFactory from '@/controllers/handler-factory';
import RuntimeError from '@/utilities/runtime-error';
import { getMetricsByTeamId } from '@/metrics/team';
import { getTrajectoryMetricsById } from '@/metrics/trajectory';
import HeadlessRasterizer from '@/services/headless-rasterizer';
import archiver from 'archiver';

const factory = new HandlerFactory<any>({
    model: Trajectory as any,
    fields: ['name', 'preview', 'isPublic'],
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

export const deleteTrajectoryById = factory.deleteOne({
    beforeDelete: async (doc: any) => {
        console.log(`Preparing to delete trajectory: ${doc.name} (ID: ${doc._id})`);
        const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
        const trajectoryPath = join(basePath, doc.folderId);
        try{
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
            return { _id: { $in: [] } };
        }

        const teamIds = userTeams.map(team => team._id);
        return { team: { $in: teamIds } };
    }
});

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

export const getMetrics = async (req: Request, res: Response) => {
    const id = (req.params as any).id || (req.params as any).trajectoryId;
    if (!id) {
      return res.status(400).json({ status: 'error', message: 'Trajectory id is required' });
    }

    const data = await getTrajectoryMetricsById(id);
    return res.status(200).json({ status: 'success', data });
};

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

// Stream atom positions [x,y,z] for a given timestep by parsing the stored LAMMPS dump file (paginated)
export const getTrajectoryAtoms = async (req: Request, res: Response) => {
    const { timestep } = req.params as any;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const pageSize = Math.max(1, Math.min(200000, parseInt((req.query.pageSize as string) || '100000', 10)));
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize; // exclusive
    const trajectory = (res as any).locals.trajectory;
    if (!trajectory) {
        return res.status(400).json({ status: 'error', data: { error: 'Trajectory not found in context' } });
    }

    try{
        const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
        const frameFilePath = join(basePath, trajectory.folderId, `${timestep}`);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');

        const { createReadStream } = await import('fs');
        const { createInterface } = await import('readline');

        const stream = createReadStream(frameFilePath, { encoding: 'utf8' });
        const rl = createInterface({ input: stream, crlfDelay: Infinity });

        let natoms: number | null = null;
    let headerCols: string[] = [];
        let inAtoms = false;
        let wroteAny = false;
        let positionsOpened = false;
        let globalIndex = 0;
    let typesPage: number[] = [];

        const write = (chunk: string) => {
            if (!res.write(chunk)) return new Promise((r) => res.once('drain', r));
            return Promise.resolve();
        };

        // Start JSON
        await write('{');
        await write(`"timestep": ${Number(timestep) || 0},`);
        await write(`"page": ${page},`);
        await write(`"pageSize": ${pageSize},`);

        const colIndex = (name: string) => headerCols.findIndex((c) => c.toLowerCase() === name);
        const findIndexFrom = (cands: string[]) => cands.map(colIndex).find((i) => i !== -1) ?? -1;

    let idxX = -1, idxY = -1, idxZ = -1, idxType = -1;

        for await (const line of rl){
            const t = line.trim();
            if(!t) continue;

            if(t === 'ITEM: NUMBER OF ATOMS'){
                const { value: next } = await rl[Symbol.asyncIterator]().next();
                if(typeof next === 'string'){
                    const v = parseInt(next.trim(), 10);
                    if(Number.isFinite(v)) natoms = v;
                }
                continue;
            }

            if(t.startsWith('ITEM: ATOMS')){
                headerCols = t.replace(/^ITEM:\s*ATOMS\s*/, '').trim().split(/\s+/);
                idxX = findIndexFrom(['x','xu','xs','xsu']);
                idxY = findIndexFrom(['y','yu','ys','ysu']);
                idxZ = findIndexFrom(['z','zu','zs','zsu']);
                idxType = findIndexFrom(['type','atom_type','atype']);
                inAtoms = true;
                // Write natoms (if known) and open positions array
                if(natoms != null){
                    await write(`"natoms": ${natoms},`);
                }
                await write('"positions":[');
                positionsOpened = true;
                continue;
            }

            if(t.startsWith('ITEM:') && inAtoms){
                // ATOMS section ended
                inAtoms = false;
                break;
            }

            if(inAtoms){
                const parts = t.split(/\s+/);
                if(parts.length < headerCols.length) continue;
                if(idxX < 0 || idxY < 0 || idxZ < 0) continue;
                const x = Number(parts[idxX]);
                const y = Number(parts[idxY]);
                const z = Number(parts[idxZ]);
                if(!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
                if(globalIndex >= startIndex && globalIndex < endIndex){
                    await write((wroteAny ? ',' : '') + `[${x},${y},${z}]`);
                    wroteAny = true;
                    if(idxType !== -1){
                        const t = Number(parts[idxType]);
                        typesPage.push(Number.isFinite(t) ? t : NaN);
                    }
                }
                globalIndex++;
            }
        }

        if(!positionsOpened){
            // No ATOMS parsed; still emit positions array key
            await write('"positions":[');
            positionsOpened = true;
        }

        await write(']');
        if(typesPage.length){
            await write(`, "types": [` + typesPage.map((v) => Number.isFinite(v) ? v : 'null').join(',') + `]`);
        }
        await write(`, "total": ${globalIndex}`);
        await write('}');
        res.end();
    }catch(err: any){
        console.error('getTrajectoryAtoms failed:', err);
        if(!res.headersSent){
            return res.status(500).json({ status: 'error', data: { error: err?.message || 'Failed to parse atoms' } });
        }
        try{ res.end(); }catch{}
    }
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

    res.sendFile(glbFilePath);
};

import { resolve, join } from 'path';
import fs from 'fs';
import archiver from 'archiver';
import type { Request, Response } from 'express';

// asume que ya tienes listGlbFiles(dir): Promise<string[]>

export const downloadTrajectoryGLBArchive = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    if(!trajectory){
        return res.status(400).json({
            status: 'error',
            data: { error: 'Trajectory not found' }
        });
    }

    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const glbDir = join(basePath, trajectory.folderId, 'glb');

    try{
        const files = await listGlbFiles(glbDir);
        if(!files.length){
            return res.status(404).json({
                status: 'error',
                data: { error: 'No GLB files found for this trajectory' }
            });
        }

        const filenameSafe = String(trajectory.name || trajectory._id).replace(/[^a-z0-9_\-]+/gi, '_');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filenameSafe}_glbs.zip"`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const archive = archiver('zip', { zlib: { level: 0 } });

        archive.on('error', (err: any) => {
            console.error('archiver error:', err);
            if(!res.headersSent){
                res.status(500).json({
                    status: 'error',
                    data: { error: 'Failed to build GLB archive' }
                });
            }else{
                res.end();
            }
        });

        archive.pipe(res);

        for(const absPath of files){
            const name = absPath.split('/').pop() || 'frame.glb';
            archive.file(absPath, { name: `glb/${name}`, store: true });
        }

        await archive.finalize();
    }catch(err){
        console.error('downloadTrajectoryGLBArchive error:', err);
        if(!res.headersSent){
            return res.status(500).json({
                status: 'error',
                data: { error: 'Failed to build GLB archive' }
            });
        }

        try{
            res.end();
        }catch{}
    }
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
    const jobs = [] as any[];

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
            glbFolderPath,
            tempFolderPath: folderPath
        } as any;
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

    // Fire-and-forget: generate a server-side PNG preview from the first frame GLB
    (async () => {
        try{
            const firstFrame = frames.reduce((min, f) => f.timestep < min.timestep ? f : min, frames[0]);
            const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
            const glbPath = join(glbFolderPath, `${firstFrame.timestep}.glb`);
            const previewPath = join(folderPath, 'preview.png');

            const waitForFile = async (file: string, timeoutMs = 120000, intervalMs = 1000) => {
                const start = Date.now();
                while(Date.now() - start < timeoutMs){
                    try{
                        await access(file, constants.F_OK);
                        // optional: small delay to ensure file is flushed
                        await new Promise(r => setTimeout(r, 250));
                        return true;
                    }catch{
                        await new Promise(r => setTimeout(r, intervalMs));
                    }
                }
                return false;
            };

            const ready = await waitForFile(glbPath);
            if(!ready){
                console.warn(`[Preview] GLB not found in time for trajectory ${newTrajectory._id} at ${glbPath}`);
                return;
            }

            const raster = new HeadlessRasterizer({
                inputPath: glbPath,
                outputPath: previewPath,
                width: 1280,
                height: 720,
                background: 'transparent',
                fov: 45,
                up: 'z',
                az: 35,
                el: 20,
                distScale: 1.05,
                maxPoints: 0
            } as any);
            await raster.render();

            await Trajectory.findByIdAndUpdate(newTrajectory._id, {
                $set: { preview: 'preview' }
            });

            console.log(`[Preview] Generated preview for trajectory ${newTrajectory._id}`);
        }catch(err){
            console.error(`[Preview] Failed to generate preview for trajectory ${newTrajectory?._id}:`, err);
        }
    })();
};