import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import BaseController from '@/controllers/base-controller';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import DumpStorage from '@/services/dump-storage';
import TrajectoryVFS from '@/services/trajectory-vfs';
import TrajectoryParserFactory from '@/parsers/factory';
import storage from '@/services/storage';
import processAndCreateTrajectory from '@/utilities/create-trajectory';
import archiver from 'archiver';
import { catchAsync } from '@/utilities/runtime/runtime';
import { getMetricsByTeamId } from '@/utilities/metrics/team';
import { Trajectory, Team } from '@/models';
import { SYS_BUCKETS } from '@/config/minio';
import { getAnyTrajectoryPreview, sendImage } from '@/utilities/export/raster';

export default class TrajectoryController extends BaseController<any> {
    constructor(){
        super(Trajectory, {
            resourceName: 'Trajectory',
            fields: ['name', 'preview', 'isPublic', 'createdBy'],
            populate: [
                { path: 'createdBy', select: 'email firstName lastName' },
                { path: 'analysis' },
                { path: 'team', select: '_id name' }
            ]
        });
    }

    /**
     * Users can only see trajectories in teams they belong to.
     */
    protected async getFilter(req: Request): Promise<any>{
        const userId = (req as any).user.id;
        const { teamId } = req.query;

        let teamQuery: any = { members: userId };
        if(teamId && typeof teamId === 'string'){
            if(!isValidObjectId(teamId)) throw new RuntimeError(ErrorCodes.VALIDATION_INVALID_TEAM_ID, 400);
            teamQuery._id = teamId;
        }

        const userTeams = await Team.find(teamQuery).select('_id');

        // If filtering by specific team ID and user isn't in it, return impossible query
        if(teamId && userTeams.length === 0) return { _id: { $in: [] } };

        const teamIds = userTeams.map((team) => team._id);
        return { team: { $in: teamIds } };
    }

    /**
     * Cleanup resources(Dump, Temp Files) before deleting the DB record
     */
    protected async onBeforeDelete(doc: any, req: Request): Promise<void>{
        const trajectoryId = doc._id.toString();
        await DumpStorage.deleteDumps(trajectoryId);
    }

    public getTeamMetrics = catchAsync(async(req: Request, res: Response) => {
        const { teamId } = req.query;
        if(!teamId || typeof teamId !== 'string'){
            throw new RuntimeError(ErrorCodes.TRAJECTORY_TEAM_ID_REQUIRED, 400);
        }
        const metrics = await getMetricsByTeamId(teamId);
        res.status(200).json({ status: 'success', data: metrics });
    });

    public getSingleMetrics = catchAsync(async(req: Request, res: Response) => {
        const trajectory = res.locals.trajectory;
        const trajectoryId = trajectory._id.toString();
        const vfs = new TrajectoryVFS(trajectoryId);

        const rootEntries = await vfs.list(`trajectory-${trajectoryId}`);
        const vfsTotalSize = rootEntries.reduce((acc, entry) => acc + (entry.size || 0), 0);

        let pluginsSize = 0;
        for await (const key of storage.listByPrefix(SYS_BUCKETS.PLUGINS, `plugins/trajectory-${trajectoryId}/`)) {
            const stat = await storage.getStat(SYS_BUCKETS.PLUGINS, key);
            pluginsSize += stat.size;
        }

        res.status(200).json({
            status: 'success',
            data: {
                frames: { totalFrames: trajectory.frames?.length || 0 },
                files: { totalSizeBytes: vfsTotalSize + pluginsSize },
                analyses: { totalAnalyses: rootEntries.filter((e) => e.name.startsWith('analysis-')).length }
            }
        });
    });

    public getPreview = catchAsync(async(req: Request, res: Response) => {
        const trajectory = res.locals.trajectory;
        const result = await getAnyTrajectoryPreview(trajectory._id.toString());

        if(!result){
            throw new RuntimeError(ErrorCodes.TRAJECTORY_FILE_NOT_FOUND, 404);
        }

        return sendImage(res, result.etag, result.buffer);
    });

    public getAtoms = catchAsync(async(req: Request, res: Response) => {
        const { timestep } = req.params as any;
        const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
        const pageSize = Math.max(1, Math.min(200000, parseInt((req.query.pageSize as string) || '100000', 10)));
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const trajectoryId = (res as any).locals.trajectory._id.toString();

        const dumpPath = await DumpStorage.getDump(trajectoryId, timestep);
        if(!dumpPath) throw new RuntimeError(ErrorCodes.TRAJECTORY_FILE_NOT_FOUND, 404);

        const parsed = await TrajectoryParserFactory.parse(dumpPath);
        const total = parsed.metadata.natoms;
        const limit = Math.min(endIndex, total);

        const positionsPage: number[][] = [];
        const typesPage: number[] = [];

        for(let i = startIndex; i < limit; i++){
            const base = i * 3;
            positionsPage.push([
                parsed.positions[base],
                parsed.positions[base + 1],
                parsed.positions[base + 2]]
            );
            if(parsed.types) typesPage.push(parsed.types[i]);
        }

        res.status(200).json({
            timestep: parsed.metadata.timestep || Number(timestep) || 0,
            page,
            pageSize,
            natoms: parsed.metadata.natoms,
            positions: positionsPage,
            types: typesPage.length ? typesPage : undefined,
            total
        });
    });

    public getGLB = catchAsync(async(req: Request, res: Response) => {
        const { timestep, analysisId } = req.params;
        const { type } = req.query as { type?: string };
        const trajectoryId = res.locals.trajectory._id.toString();
        const vfs = new TrajectoryVFS(trajectoryId);

        let virtualPath = '';
        if(analysisId === 'default' || !type){
            virtualPath = `trajectory-${trajectoryId}/previews/timestep-${timestep}.glb`;
        }else{
            const glbFiles = await vfs.list(`trajectory-${trajectoryId}/analysis-${analysisId}/glb`);
            const match = glbFiles.find(f => f.name.includes(type) && f.name.includes(timestep));
            if(!match) throw new RuntimeError(ErrorCodes.TRAJECTORY_FILE_NOT_FOUND, 404);
            virtualPath = match.relPath;
        }

        const { stream, size, filename } = await vfs.getReadStream(virtualPath);
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Length', size);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        if(analysisId === 'default') res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        stream.pipe(res);
    });

    public downloadGLBArchive = catchAsync(async(req: Request, res: Response) => {
        const trajectory = res.locals.trajectory;
        const trajectoryId = trajectory._id.toString();
        const { analysisId } = req.params;
        const vfs = new TrajectoryVFS(trajectoryId);

        const entries = await vfs.list(`trajectory-${trajectoryId}/analysis-${analysisId}/glb`);
        const frameFilter = req.query.frame ? String(req.query.frame) : null;

        const filesToZip = entries.filter((entry) => {
            if(entry.type !== 'file') return false;
            if(frameFilter && !entry.name.includes(frameFilter)) return false;
            return true;
        });

        if(!filesToZip.length) throw new RuntimeError(ErrorCodes.TRAJECTORY_FILES_NOT_FOUND, 404);

        const filename = String(trajectory.name || trajectoryId).replace(/[^a-z0-9_\-]+/gi, '_');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}_${analysisId}.zip"`);

        const archive = archiver('zip', { zlib: { level: 0 } });

        archive.on('error', () => {
            if(!res.headersSent) res.status(500).end();
        });

        archive.pipe(res);

        for(const file of filesToZip){
            const { stream } = await vfs.getReadStream(file.relPath);
            archive.append(stream, { name: `glb/${file.name}` });
        }

        await archive.finalize();
    });

    public create = catchAsync(async(req: Request, res: Response) => {
        const userId = (req as any).user._id;
        const { teamId, originalFolderName, uploadId } = req.body;

        let trajectoryName = req.body.name;
        if(!trajectoryName && originalFolderName && originalFolderName.length >= 4){
            trajectoryName = originalFolderName;
        }
        if(!trajectoryName) trajectoryName = 'Untitled Trajectory';

        let trajectory;
        try{
            trajectory = await processAndCreateTrajectory({
                files: req.files as any[],
                teamId,
                userId: (req as any).user._id,
                trajectoryName,
                originalFolderName: req.body.originalFolderName,
                onProgress: (progress) => {
                    if(uploadId){
                        const io = req.app.get('io');
                        io.to(`upload:${uploadId}`).emit('trajectory:upload-progress', {
                            uploadId,
                            progress
                        });
                        io.to(`user:${userId}`).emit('trajectory:upload-progress', {
                            uploadId,
                            progress
                        });
                    }
                }
            });
            res.status(201).json({
                status: 'success',
                data: trajectory
            });
        }finally{
            if(req.files && Array.isArray(req.files)) {
                await Promise.all((req.files as any[]).map(f =>
                    require('fs').promises.unlink(f.path).catch(() => { })
                ));
            }
        }
    });
};
