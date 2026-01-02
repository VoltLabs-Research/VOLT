import { Request, Response } from 'express';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import TrajectoryVFS from '@/services/trajectory/virtual-fs';
import { catchAsync } from '@/utilities/runtime/runtime';
import { Trajectory, User } from '@/models';
import BaseController from '@/controllers/base-controller';
import { Resource } from '@/constants/resources';

const breadcrumbsOf = (rel: string) => {
    const parts = rel.split('/').filter(Boolean);
    const crumbs = [{ name: 'root', relPath: '' }];
    let acc = '';
    for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        crumbs.push({ name: part, relPath: acc });
    }
    return crumbs;
};

export default class TrajectoryVfsController extends BaseController<any> {
    constructor(){
        super(Trajectory, {
            resource: Resource.TRAJECTORY
        });
    }
    
    public listTrajectoryFs = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        if (!user) {
            throw new RuntimeError(ErrorCodes.AUTH_UNAUTHORIZED, 401);
        }

        const userId = user._id || user.id;
        const pathParam = String(req.query.path || '');

        const trajFS = new TrajectoryVFS(userId);

        try {
            const entries = await trajFS.list(pathParam);
            const breadcrumbs = breadcrumbsOf(pathParam);

            res.status(200).json({
                status: 'success',
                data: {
                    trajectory: null,
                    cwd: pathParam,
                    selected: null,
                    breadcrumbs,
                    entries
                }
            });
        } catch (err: any) {
            if (err instanceof RuntimeError) {
                throw err;
            }
            throw new RuntimeError(ErrorCodes.TRAJECTORY_VFS_FILE_SYSTEM_ERROR, 500);
        }
    });

    public downloadTrajectoryFs = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        if (!user) {
            throw new RuntimeError(ErrorCodes.AUTH_UNAUTHORIZED, 401);
        }

        const userId = user._id || user.id;
        const pathParam = String(req.query.path || '');

        const trajFS = new TrajectoryVFS(userId);

        try {
            const { stream, size, contentType, filename } = await trajFS.getReadStream(pathParam);

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', size);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            stream.pipe(res);
        } catch (err: any) {
            if (err instanceof RuntimeError) {
                throw err;
            }
            throw new RuntimeError(ErrorCodes.TRAJECTORY_VFS_DOWNLOAD_ERROR, 500);
        }
    });

    public listUserTrajectories = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        if (!user) {
            throw new RuntimeError(ErrorCodes.AUTH_UNAUTHORIZED, 401);
        }

        const userId = user._id || user.id;

        try {
            const userWithTeams = await User.findById(userId).populate('teams').lean();

            if (!userWithTeams || !userWithTeams.teams) {
                return res.status(200).json({
                    status: 'success',
                    data: {
                        trajectories: []
                    }
                });
            }

            const teamIds = (userWithTeams.teams as any[]).map(team => team._id);

            const trajectories = await Trajectory.find({
                team: { $in: teamIds }
            })
                .select('_id name team status createdAt updatedAt')
                .populate('team', 'name')
                .sort({ updatedAt: -1 })
                .lean();

            res.status(200).json({
                status: 'success',
                data: {
                    trajectories: trajectories.map(traj => ({
                        id: traj._id.toString(),
                        name: traj.name,
                        status: traj.status,
                        team: {
                            id: (traj.team as any)._id.toString(),
                            name: (traj.team as any).name
                        },
                        createdAt: traj.createdAt,
                        updatedAt: traj.updatedAt
                    }))
                }
            });
        } catch (err: any) {
            if (err instanceof RuntimeError) {
                throw err;
            }
            throw new RuntimeError(ErrorCodes.TRAJECTORY_VFS_FETCH_ERROR, 500);
        }
    });
}
