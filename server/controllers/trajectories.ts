/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import { NextFunction, Request, Response } from 'express';
import { join } from 'path';
import { rm } from 'fs/promises';
import { isValidObjectId } from 'mongoose';
import { Trajectory, Team } from '@models/index';
import { listByPrefix, statObject } from '@/utilities/buckets';
import { getTimestepPreview, sendImage } from '@/utilities/raster';
import { SYS_BUCKETS } from '@/config/minio';
import { catchAsync } from '@/utilities/runtime';
import { createInterface } from 'node:readline';
import { getMetricsByTeamId } from '@/utilities/metrics/team';
import processAndCreateTrajectory from '@/utilities/create-trajectory';
import TrajectoryVFS from '@/services/trajectory-vfs';
import RuntimeError from '@/utilities/runtime-error';
import HandlerFactory from '@/controllers/handler-factory';
import DumpStorage from '@/services/dump-storage';
import archiver from 'archiver';
import logger from '@/logger';
import * as os from 'node:os';

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

export const getMetrics = catchAsync(async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const trajectoryId = trajectory._id.toString();
    const vfs = new TrajectoryVFS(trajectoryId);
    
    const rootEntries = await vfs.list(`trajectory-${trajectoryId}`);
    let vfsTotalSize = rootEntries.reduce((acc, entry) => acc + (entry.size || 0), 0);

    let pluginsSize = 0;
    const pluginKeys = await listByPrefix(`plugins/trajectory-${trajectoryId}/`, SYS_BUCKETS.PLUGINS);
    for(const key of pluginKeys){
        const stat = await statObject(key, SYS_BUCKETS.PLUGINS);
        pluginsSize += stat.size;
    }

    const totalSizeBytes = vfsTotalSize + pluginsSize;
    const totalFrames = trajectory.frames?.length || 0;
    const totalAnalyses = rootEntries.filter((e) => e.name.startsWith('analysis-')).length;

    return res.status(200).json({
        status: 'success',
        data: {
            frames: { totalFrames },
            files: { totalSizeBytes },
            analyses: { totalAnalyses }
        }
    });
});

export const deleteTrajectoryById = factory.deleteOne({
    beforeDelete: async (doc: any) => {
        const trajectoryId = doc._id.toString();

        await DumpStorage.deleteDumps(trajectoryId);

        // Clean up temporary filesystem files if they exist
        const trajectoryDir = process.env.TRAJECTORY_DIR || join(os.tmpdir(), 'opendxa-trajectories');
        const trajectoryPath = join(trajectoryDir, trajectoryId);
        try {
            await rm(trajectoryPath, { recursive: true, force: true });
            logger.info(`Cleaned up temp directory: ${trajectoryPath}`);
        } catch (error) {
            logger.warn(`Warning: Could not clean up temp files for trajectory ${trajectoryId}: ${error}`);
        }
    }
});

export const getUserTrajectories = factory.getAll({
    customFilter: async (req: Request) => {
        const userId = (req as any).user.id;
        const { teamId } = req.query;

        let teamQuery: any = { members: userId };
        if (teamId && typeof teamId === 'string') {
            if (!isValidObjectId(teamId)) {
                throw new RuntimeError('Trajectory::Team::InvalidId', 400);
            }
            teamQuery._id = teamId;
        }

        const userTeams = await Team.find(teamQuery).select('_id');

        if (teamId && userTeams.length === 0) {
            return { _id: { $in: [] } };
        }

        const teamIds = userTeams.map(team => team._id);
        return { team: { $in: teamIds } };
    }
});

export const getTrajectoryPreview = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    // TODO: maybe it's not efficient
    const timestep = Math.min(...trajectory.frames.map(({ timestep }: any) => timestep));
    const { buffer, etag } = await getTimestepPreview(trajectory._id.toString(), timestep);
    return sendImage(res, etag, buffer);
};

// Stream atom positions [x,y,z] for a given timestep by parsing the stored LAMMPS dump file (paginated)
export const getTrajectoryAtoms = async (req: Request, res: Response) => {
    const { timestep } = req.params as any;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const pageSize = Math.max(1, Math.min(200000, parseInt((req.query.pageSize as string) || '100000', 10)));
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const trajectory = (res as any).locals.trajectory;
    const trajectoryId = trajectory._id.toString();

    try {
        const vfs = new TrajectoryVFS(trajectoryId);
        const { stream: dataStream } = await vfs.getReadStream(`trajectory-${trajectoryId}/dumps/${timestep}`);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');

        const rl = createInterface({ input: dataStream, crlfDelay: Infinity });

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

        for await (const line of rl) {
            const t = line.trim();
            if (!t) continue;

            if (t === 'ITEM: NUMBER OF ATOMS') {
                const { value: next } = await rl[Symbol.asyncIterator]().next();
                if (typeof next === 'string') {
                    const v = parseInt(next.trim(), 10);
                    if (Number.isFinite(v)) natoms = v;
                }
                continue;
            }

            if (t.startsWith('ITEM: ATOMS')) {
                headerCols = t.replace(/^ITEM:\s*ATOMS\s*/, '').trim().split(/\s+/);
                idxX = findIndexFrom(['x', 'xu', 'xs', 'xsu']);
                idxY = findIndexFrom(['y', 'yu', 'ys', 'ysu']);
                idxZ = findIndexFrom(['z', 'zu', 'zs', 'zsu']);
                idxType = findIndexFrom(['type', 'atom_type', 'atype']);
                inAtoms = true;
                // Write natoms (if known) and open positions array
                if (natoms != null) {
                    await write(`"natoms": ${natoms},`);
                }
                await write('"positions":[');
                positionsOpened = true;
                continue;
            }

            if (t.startsWith('ITEM:') && inAtoms) {
                // ATOMS section ended
                inAtoms = false;
                break;
            }

            if (inAtoms) {
                const parts = t.split(/\s+/);
                if (parts.length < headerCols.length) continue;
                if (idxX < 0 || idxY < 0 || idxZ < 0) continue;
                const x = Number(parts[idxX]);
                const y = Number(parts[idxY]);
                const z = Number(parts[idxZ]);
                if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
                if (globalIndex >= startIndex && globalIndex < endIndex) {
                    await write((wroteAny ? ',' : '') + `[${x},${y},${z}]`);
                    wroteAny = true;
                    if (idxType !== -1) {
                        const t = Number(parts[idxType]);
                        typesPage.push(Number.isFinite(t) ? t : NaN);
                    }
                }
                globalIndex++;
            }
        }

        if (!positionsOpened) {
            // No ATOMS parsed; still emit positions array key
            await write('"positions":[');
            positionsOpened = true;
        }

        await write(']');
        if (typesPage.length) {
            await write(`, "types": [` + typesPage.map((v) => Number.isFinite(v) ? v : 'null').join(',') + `]`);
        }
        await write(`, "total": ${globalIndex}`);
        await write('}');
        res.end();
    } catch (err: any) {
        logger.error(`getTrajectoryAtoms failed: ${err}`);
        if (!res.headersSent) {
            return res.status(500).json({ status: 'error', data: { error: err?.message || 'Failed to parse atoms' } });
        }
        try { res.end(); } catch { }
    }
};

export const getTrajectoryGLB = catchAsync(async (req: Request, res: Response) => {
    const { timestep, analysisId } = req.params;
    const { type } = req.query as { type?: string };
    const trajectory = res.locals.trajectory;
    const trajectoryId = trajectory._id.toString();
    const vfs = new TrajectoryVFS(trajectoryId);
    
    let virtualPath = '';
    
    if (analysisId === 'default' || !type) {
        virtualPath = `trajectory-${trajectoryId}/previews/timestep-${timestep}.glb`;
    } else {
        const glbFiles = await vfs.list(`trajectory-${trajectoryId}/analysis-${analysisId}/glb`);
        const match = glbFiles.find(f => f.name.includes(type) && f.name.includes(timestep));
        
        if (!match) throw new RuntimeError('FileNotFound', 404);
        virtualPath = match.relPath;
    }

    const { stream, size, filename } = await vfs.getReadStream(virtualPath);

    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Length', size);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    if (analysisId === 'default') res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    
    stream.pipe(res);
});

export const downloadTrajectoryGLBArchive = catchAsync(async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const trajectoryId = trajectory._id.toString();
    const { analysisId, type } = req.params;
    const vfs = new TrajectoryVFS(trajectoryId);

    const entries = await vfs.list(`trajectory-${trajectoryId}/analysis-${analysisId}/glb`);
    const frameFilter = req.query.frame ? String(req.query.frame) : null;

    const filesToZip = entries.filter(e => {
        if(e.type !== 'file') return false;
        if(frameFilter && !e.name.includes(frameFilter)) return false;
        return true;
    });

    if (!filesToZip.length) return res.status(404).json({ status: 'error', data: { error: 'No files found' } });

    const filename = String(trajectory.name || trajectoryId).replace(/[^a-z0-9_\-]+/gi, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}_${analysisId}.zip"`);
    
    const archive = archiver('zip', { zlib: { level: 0 } });
    archive.on('error', () => { if(!res.headersSent) res.status(500).end(); });
    archive.pipe(res);

    // 2. Stream de cada archivo al ZIP
    for (const file of filesToZip) {
        const { stream } = await vfs.getReadStream(file.relPath);
        archive.append(stream, { name: `glb/${file.name}` });
    }

    await archive.finalize();
});

export const createTrajectory = async (req: Request, res: Response, next: NextFunction) => {
    const { files, teamId } = (res as any).locals.data;
    const userId = (req as any).user._id;
    const trajectoryName = (req.body.originalFolderName || 'Untitled Trajectory') as string;

    try {
        const newTrajectory = await processAndCreateTrajectory(
            files,
            teamId,
            userId.toString(),
            trajectoryName
        );

        res.status(201).json({
            status: 'success',
            data: newTrajectory
        });
    } catch (error) {
        next(error);
    }
};