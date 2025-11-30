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
import TrajectoryVFS from '@/services/trajectory-vfs';
import RuntimeError from '@/utilities/runtime-error';
import { Trajectory, User } from '@/models';

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

export const listTrajectoryFs = async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
        throw new RuntimeError('Unauthorized', 401);
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
        throw new RuntimeError('FileSystemError', 500);
    }
};

export const downloadTrajectoryFs = async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
        throw new RuntimeError('Unauthorized', 401);
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
        throw new RuntimeError('DownloadError', 500);
    }
};

export const listUserTrajectories = async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
        throw new RuntimeError('Unauthorized', 401);
    }

    const userId = user._id || user.id;

    try {
        // Fetch user with teams populated
        const userWithTeams = await User.findById(userId).populate('teams').lean();

        if (!userWithTeams || !userWithTeams.teams) {
            return res.status(200).json({
                status: 'success',
                data: {
                    trajectories: []
                }
            });
        }

        // Extract team IDs
        const teamIds = (userWithTeams.teams as any[]).map(team => team._id);

        // Fetch all trajectories belonging to these teams
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
        throw new RuntimeError('FetchTrajectoriesError', 500);
    }
};