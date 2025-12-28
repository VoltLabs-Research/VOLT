import { Request, Response } from 'express';
import { catchAsync } from '@/utilities/runtime/runtime';
import MetricsCollector from '@/services/metrics-collector';
import { Resource } from '@/constants/resources';
import { Action } from '@/constants/permissions';

const metricsCollector = new MetricsCollector();

const RESOURCE_LABELS: Record<string, string> = {
    [Resource.TEAM]: 'Team',
    [Resource.TRAJECTORY]: 'Trajectories',
    [Resource.TEAM_INVITATION]: 'Invitations',
    [Resource.TEAM_MEMBER]: 'Members',
    [Resource.TEAM_ROLE]: 'Roles',
    [Resource.SSH_CONNECTION]: 'SSH Connections',
    [Resource.PLUGIN]: 'Plugins',
    [Resource.CONTAINER]: 'Containers',
    [Resource.ANALYSIS]: 'Analysis'
};

const ACTION_LABELS: Record<Action, string> = {
    [Action.READ]: 'Read',
    [Action.CREATE]: 'Create',
    [Action.UPDATE]: 'Update',
    [Action.DELETE]: 'Delete'
};

export default class SystemController {
    public getSystemStats = catchAsync(async (_req: Request, res: Response) => {
        let stats = await metricsCollector.getLatestFromRedis();

        if (!stats) {
            stats = await metricsCollector.collect();
        }

        res.status(200).json({
            status: 'success',
            data: {
                stats
            }
        });
    });

    public getRBACConfig = catchAsync(async (_req: Request, res: Response) => {
        // Get RBAC-enabled resources from the RESOURCE_LABELS mapping
        const resources = Object.entries(RESOURCE_LABELS).map(([key, label]) => ({
            key,
            label
        }));

        // Get all actions from the Action enum
        const actions = Object.values(Action).map(action => ({
            key: action,
            label: ACTION_LABELS[action]
        }));

        res.status(200).json({
            status: 'success',
            data: {
                resources,
                actions
            }
        });
    });
};