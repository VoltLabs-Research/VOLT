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
import { join, relative, resolve } from 'path';
import { stat, mkdir, rm, writeFile } from 'fs/promises';
import { isValidObjectId } from 'mongoose';
import { getTrajectoryProcessingQueue } from '@/queues';
import { processTrajectoryFile } from '@/utilities/lammps';
import { Trajectory, Team } from '@models/index';
import { getMetricsByTeamId } from '@/metrics/team';
import { getTrajectoryMetricsById } from '@/metrics/trajectory';

import TrajectoryFS from '@/services/trajectory-fs';
import RuntimeError from '@/utilities/runtime-error';
import HandlerFactory from '@/controllers/handler-factory';
import archiver from 'archiver';
import { v4 } from 'uuid';
import { statGLBObject, getGLBStream } from '@/buckets/glbs';

const factory = new HandlerFactory<any>({
    model: Trajectory as any,
    fields: ['name', 'preview', 'isPublic', 'createdBy'],
    errorMessages: {
        default: {
            notFound: 'Trajectory::NotFound',
            unauthorized: 'Trajectory::AccessDenied',
            validation: 'Trajectory::ValidationError'
        }
    },
    defaultErrorConfig: 'default',
    populate: {
        default: {
            path: 'createdBy',
            select: 'email firstName lastName'
        },
        analysis: {
            path: 'analysis'
        },
        team: {
            path: 'team',
            select: '_id name'
        }
    },
    defaultPopulate: 'default'
});

const sendFileInline = async (
    res: Response,
    absPath: string,
    contentType: string,
    filename?: string
) => {
    const st = await stat(absPath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', st.size);
    if(filename){
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    }else{
        res.setHeader('Content-Disposition', 'inline');
    }
    return res.sendFile(absPath);
};


export const getTrajectoryById = factory.getOne();
export const updateTrajectoryById = factory.updateOne();

export const getTrajectoryMetrics = async (req: Request, res: Response) => {
    const { teamId } = req.query;
    
    if (!teamId || typeof teamId !== 'string') {
        return res.status(400).json({
            status: 'error',
            message: 'teamId query parameter is required'
        });
    }
    
    const teamMetrics = await getMetricsByTeamId(teamId);

    return res.status(200).json({
        status: 'success',
        data: teamMetrics
    });
};

export const deleteTrajectoryById = factory.deleteOne({
    beforeDelete: async (doc: any) => {
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
                throw new RuntimeError('Trajectory::Team::InvalidId', 400);
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
    const analysisId = req.params.analysisId;

    if(!trajectory){
        return res.status(400).json({
            status: 'error',
            data: { error: 'Trajectory not found in context' },
        });  
    }

    const trajFS = new TrajectoryFS(trajectory.folderId);

     const TYPES = [
        'atoms_colored_by_type', 
        'dislocations',
        'defect_mesh',
        'interface_mesh'
    ] as const;

    // MinIO keys are already in the format we need, just extract the relative part
    const toRel = (minioKey: string) => {
        // MinIO key format: {trajectoryId}/{analysisId}/glb/{frame}/{type}.glb
        // We want: {analysisId}/glb/{frame}/{type}.glb
        const parts = minioKey.split('/');
        // Remove trajectoryId (first part)
        return parts.slice(1).join('/');
    };

    const typeMap: Record<string, Record<string, string>> = {
        atoms_colored_by_type: {},
        dislocations: {},
        defect_mesh: {},
        interface_mesh: {}
    };

    for (const type of TYPES) {
        const maps = await trajFS.getAnalysis(analysisId, type, { media: 'glb' });
        const glbByFrame = maps.glb || {};
        for(const frame of Object.keys(glbByFrame).sort((a, b) => Number(a) - Number(b))){
            typeMap[type][frame] = toRel(glbByFrame[frame]);
        }
    }

    return res.status(200).json({
        status: 'success',
        data: typeMap
    });
};

export const getMetrics = async (req: Request, res: Response) => {
    const id = (req.params as any).id || (req.params as  any).trajectoryId;
    if (!id) {
      return res.status(400).json({ status: 'error', message: 'Trajectory id is required' });
    }

    const data = await getTrajectoryMetricsById(id);
    return res.status(200).json({ status: 'success', data });
};

export const getTrajectoryPreview = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const trajFS = new TrajectoryFS(trajectory.folderId);
    
    let previewPath: string | null = null;
    
    // First, try to get the root preview.png (main preview generated during upload)
    const rootPreviews = await trajFS.getPreviews();
    if (rootPreviews.previewPng) {
        previewPath = rootPreviews.previewPng;
    } else {
        // Fallback: try to get the first available raster preview
        const rasterPreviews = await trajFS.getPreviews({ media: 'raster' });
        const rasterMap = rasterPreviews.raster || {};
        const firstKey = Object.keys(rasterMap).sort((a, b) => Number(a) - Number(b))[0];
        if (firstKey && rasterMap[firstKey]) {
            previewPath = rasterMap[firstKey];
        }
    }
    
    if (!previewPath) {
        return res.status(404).json({
            status: 'error',
            data: { error: 'Preview not found' }
        });
    }

    const filename = `${trajectory.name || trajectory._id}_preview.png`;
    return await sendFileInline(res, previewPath, 'image/png', filename);
};

// Stream atom positions [x,y,z] for a given timestep by parsing the stored LAMMPS dump file (paginated)
export const getTrajectoryAtoms = async (req: Request, res: Response) => {
    const { timestep } = req.params as any;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const pageSize = Math.max(1, Math.min(200000, parseInt((req.query.pageSize as string) || '100000', 10)));
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const trajectory = (res as any).locals.trajectory;
    if (!trajectory) {
        return res.status(400).json({ status: 'error', data: { error: 'Trajectory not found in context' } });
    }

    try{
        const trajFS = new TrajectoryFS(trajectory.folderId);
        const frameFilePath = await trajFS.getDump(timestep);

        if(!frameFilePath){
            return res.status(404).json({
                status: 'error',
                data: { error: 'Dump not found' }
            });
        }

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
    try{
        const { timestep, analysisId } = req.params;
        const { type } = req.query as { type?: string };
        const trajectory = res.locals.trajectory as { name: string; folderId: string; frames: Array<{ timestep: number | string }> };

        const trajFS = new TrajectoryFS(trajectory.folderId);

        let result = null;
        
        // If analysisId is 'default' or no type specified, get from previews
        // Otherwise get from analysis
        if(analysisId === 'default' || !type){
            result = await trajFS.getPreviews({ media: 'glb' });
        }else{
            result = await trajFS.getAnalysis(analysisId, type, { media: 'glb' });
        }

        const glbKey = result.glb?.[String(timestep)];
        if(!glbKey){
            return res.status(404).json({
                status: 'error',    
                data: { error: `GLB file for timestep ${timestep} not found (analysisId=${analysisId}, type=${type})` }
            });
        }

        // Get GLB from MinIO
        const stat = await statGLBObject(glbKey);
        const stream = await getGLBStream(glbKey);

        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename="${trajectory.name}_${timestep}.glb"`);

        if(analysisId === 'default' || !type){
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }

        stream.pipe(res);
    }catch(err){
        console.error('[getTrajectoryGLB] Error:', err);
        return res.status(500).json({ status: 'error', data: { error: 'Internal server error' }});
    }
};

export const downloadTrajectoryGLBArchive = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const { analysisId, type } = req.params;
    const trajFS = new TrajectoryFS(trajectory.folderId);
    const maps = await trajFS.getAnalysis(analysisId, type, { media: 'glb' });
    const glbMap = maps.glb || {};
    const frameFilter = req.query.frame ? String(req.query.frame): null;

    const glbKeys = Object.entries(glbMap)
        .filter(([frame]) => !frameFilter || frameFilter === frame)
        .map(([, key]) => key);

    if(!glbKeys.length){
        return res.status(404).json({
            status: 'error',
            data: { error: 'No GLB files found' }
        });
    }

    const filename = String(trajectory.anme || trajectory._id).replace(/[^a-z0-9_\-]+/gi, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}_${analysisId}_${type}.zip"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const archive = archiver('zip', { zlib: { level: 0 } });
    archive.on('error', (err: any) => {
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
    
    // Stream GLBs from MinIO into the archive
    for(const glbKey of glbKeys){
        const name = glbKey.split('/').pop() || 'frame.glb';
        const stream = await getGLBStream(glbKey);
        archive.append(stream, { name: `glb/${name}` });
    }

    await archive.finalize();
};

export const createTrajectory = async (req: Request, res: Response, next: NextFunction) => {
    const { files, teamId } = (res as any).locals.data;
    const userId = (req as any).user._id;

    const folderId = v4();
    const folderPath = join(process.env.TRAJECTORY_DIR as string, folderId);
    await mkdir(folderPath, { recursive: true });

    const trajFS = new TrajectoryFS(folderId, process.env.TRAJECTORY_DIR);
    await trajFS.ensureStructure(); 

    const filePromises = files.map(async (file: any, i: number) => {
        try{
            const tempPath = join(folderPath, `temp_${i}_${Date.now()}_${Math.random().toString(36).slice(2)}`);
            await writeFile(tempPath, file.buffer);
            try{
                const { frameInfo, isValid } = await processTrajectoryFile(tempPath, tempPath);
                if(!frameInfo || !isValid){
                    await rm(tempPath).catch(() => {});
                    return null;
                }

                const dumpAbsPath = await trajFS.saveDump(frameInfo.timestep, file.buffer, true);
                await rm(tempPath).catch(() => {});

                const frameData = {
                    ...frameInfo
                    // GLBs are now stored in MinIO, not in frame data
                };

                return {
                    frameData,
                    srcPath: dumpAbsPath,
                    originalSize: file.size,
                    originalName: file.originalname || `frame_${frameInfo.timestep}`
                };
            }catch(error){
                await rm(tempPath).catch(() => {});
                return null;
            }
        }catch(error){
            return null;
        }finally{
            file.buffer = null;
        }
    });

    const results = await Promise.all(filePromises);
    const validFiles = (results.filter(Boolean) as any[]);

    if(validFiles.length === 0){
            await rm(folderPath, { recursive: true, force: true });
        return next(new RuntimeError('Trajectory::NoValidFiles', 400));
    }

    const totalSize = validFiles.reduce((acc, f) => acc + f.originalSize, 0);
    const frames = validFiles.map(f => f.frameData);

    const trajectoryName = (req.body.originalFolderName || 'Untitled Trajectory') as string;
    const newTrajectory = await Trajectory.create({
        folderId,
        name: trajectoryName,
        team: teamId,
        createdBy: userId,
        frames,
        status: 'processing',
        stats: {
            totalFiles: validFiles.length,
            totalSize
        }
    });

    const trajectoryProcessingQueue = getTrajectoryProcessingQueue();
    const CHUNK_SIZE = 20;
    const jobs: any[] = [];

    for(let i = 0; i < validFiles.length; i += CHUNK_SIZE){
        const chunk = validFiles.slice(i, i + CHUNK_SIZE);
        jobs.push({
            jobId: v4(),
            trajectoryId: newTrajectory._id.toString(),
            folderId: folderId, // UUID for MinIO paths
            chunkIndex: Math.floor(i / CHUNK_SIZE),
            totalChunks: Math.ceil(validFiles.length / CHUNK_SIZE),
            files: chunk.map(({ frameData, srcPath }) => ({
                frameData,
                frameFilePath: srcPath 
            })),
            teamId,
            name: 'Upload Trajectory',
            message: trajectoryName,
            folderPath,
            tempFolderPath: folderPath
        });
    }

    // Add all jobs at once to ensure they share the same sessionId
    trajectoryProcessingQueue.addJobs(jobs);

    res.status(201).json({
        status: 'success',
        data: newTrajectory
    });
};