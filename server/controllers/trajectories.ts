import { NextFunction, Request, Response } from 'express';
import BaseController from '@/controllers/base-controller';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import DumpStorage from '@/services/dump-storage';
import TrajectoryVFS from '@/services/trajectory-vfs';
import processAndCreateTrajectory from '@/utilities/trajectory/create-trajectory';
import archiver from 'archiver';
import { catchAsync } from '@/utilities/runtime/runtime';
import { getMetricsByTeamId } from '@/utilities/metrics/team';
import { Trajectory, Team, DailyActivity } from '@/models';
import { TeamActivityType } from '@/models/daily-activity';
import { getAnyTrajectoryPreview, sendImage } from '@/utilities/raster';
import { Action, Resource } from '@/constants/permissions';
import getPopulatedFrameAtoms from '@/utilities/trajectory/get-populated-frame-atoms';

export default class TrajectoryController extends BaseController<any> {
    constructor() {
        super(Trajectory, {
            resourceName: 'Trajectory',
            resource: Resource.TRAJECTORY,
            fields: ['originalFolderName', 'uploadId', 'teamId', 'preview', 'isPublic', 'createdBy'],
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
    protected async getFilter(req: Request): Promise<any> {
        const userId = (req as any).user.id;
        const teamId = await this.getTeamId(req);

        let teamQuery: any = { members: userId };
        if(teamId){
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
    protected async onBeforeDelete(doc: any, req: Request): Promise<void> {
        const trajectoryId = doc._id.toString();
        const teamId = await this.getTeamId(req);
        await this.authorize(req, teamId, Action.DELETE, Resource.TRAJECTORY);
        await DumpStorage.deleteDumps(trajectoryId);
    }

    public async create(data: Partial<any>, req: Request): Promise<any>{
        const { originalFolderName, uploadId } = req.body;
        const userId = (req as any).user._id;
        const teamId = await this.getTeamId(req);

        let trajectoryName = 'Untitled Trajectory';
        if(originalFolderName && originalFolderName.length >= 4){
            trajectoryName = originalFolderName;
        }

        const trajectory = await processAndCreateTrajectory({
            files: req.files as any[],
            teamId,
            userId: (req as any).user._id,
            trajectoryName,
            originalFolderName: data.originalFolderName,
            onProgress: (progress) => {
                if(!uploadId) return;
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
        });

        return trajectory;
    }

    protected async onAfterCreate(doc: any, req: Request): Promise<void> {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        await DailyActivity.updateOne(
            { team: doc.team, user: doc.createdBy, date: startOfDay },
            {
                $push: {
                    activity: {
                            type: TeamActivityType.TRAJECTORY_UPLOAD,
                            user: doc.createdBy,
                            description: `${req.user.firstName} ${req.user.lastName} has loaded a trajectory (${doc.name})`,
                            createdAt: new Date()
                    }
                }
            }
        );
    }

    public getTeamMetrics = catchAsync(async (req: Request, res: Response) => {
        const teamId = await this.getTeamId(req);
        const metrics = await getMetricsByTeamId(teamId);
        res.status(200).json({ status: 'success', data: metrics });
    });

    public getPreview = catchAsync(async (req: Request, res: Response) => {
        const trajectory = res.locals.trajectory;
        const result = await getAnyTrajectoryPreview(trajectory._id.toString());

        if (!result) {
            throw new RuntimeError(ErrorCodes.TRAJECTORY_FILE_NOT_FOUND, 404);
        }

        return sendImage(res, result.etag, result.buffer);
    });

    public getAtoms = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { analysisId } = req.params;
        const { timestep, exposureId, page: pageStr, pageSize: pageSizeStr } = req.query;
        const trajectoryId = res.locals.trajectory._id.toString();

        if (!timestep || !exposureId) {
            return next(new RuntimeError(ErrorCodes.COLOR_CODING_MISSING_PARAMS, 400));
        }

        const page = Math.max(1, parseInt(String(pageStr) || '1', 10));
        const pageSize = Math.max(1, Math.min(10000, parseInt(String(pageSizeStr) || '1000', 10)));
        
        const populatedAtoms = getPopulatedFrameAtoms(trajectoryId, timestep as string, analysisId, exposureId as string, page, pageSize);
        res.status(200).json({ status: 'success', ...populatedAtoms });
    });

    public getGLB = catchAsync(async (req: Request, res: Response) => {
        const { timestep, analysisId } = req.params;
        const { type } = req.query as { type?: string };
        const trajectoryId = res.locals.trajectory._id.toString();
        const vfs = new TrajectoryVFS(trajectoryId);

        let virtualPath = '';
        if (analysisId === 'default' || !type) {
            virtualPath = `trajectory-${trajectoryId}/previews/timestep-${timestep}.glb`;
        } else {
            const glbFiles = await vfs.list(`trajectory-${trajectoryId}/analysis-${analysisId}/glb`);
            const match = glbFiles.find(f => f.name.includes(type) && f.name.includes(timestep));
            if (!match) throw new RuntimeError(ErrorCodes.TRAJECTORY_FILE_NOT_FOUND, 404);
            virtualPath = match.relPath;
        }

        const { stream, size, filename } = await vfs.getReadStream(virtualPath);
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Length', size);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        if (analysisId === 'default') res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        stream.pipe(res);
    });

    public downloadGLBArchive = catchAsync(async (req: Request, res: Response) => {
        const trajectory = res.locals.trajectory;
        const trajectoryId = trajectory._id.toString();
        const { analysisId } = req.params;
        const vfs = new TrajectoryVFS(trajectoryId);

        const entries = await vfs.list(`trajectory-${trajectoryId}/analysis-${analysisId}/glb`);
        const frameFilter = req.query.frame ? String(req.query.frame) : null;

        const filesToZip = entries.filter((entry) => {
            if (entry.type !== 'file') return false;
            if (frameFilter && !entry.name.includes(frameFilter)) return false;
            return true;
        });

        if (!filesToZip.length) throw new RuntimeError(ErrorCodes.TRAJECTORY_FILES_NOT_FOUND, 404);

        const filename = String(trajectory.name || trajectoryId).replace(/[^a-z0-9_\-]+/gi, '_');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}_${analysisId}.zip"`);

        const archive = archiver('zip', { zlib: { level: 0 } });

        archive.on('error', () => {
            if (!res.headersSent) res.status(500).end();
        });

        archive.pipe(res);

        for (const file of filesToZip) {
            const { stream } = await vfs.getReadStream(file.relPath);
            archive.append(stream, { name: `glb/${file.name}` });
        }

        await archive.finalize();
    });
};