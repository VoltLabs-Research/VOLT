import TeamClusterDirectAccessGrantService from '@modules/team-cluster/infrastructure/services/TeamClusterDirectAccessGrantService';
import {
    TEAM_CLUSTER_DIRECT_ACCESS_BASE_PATH,
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER,
    TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER
} from '@shared/infrastructure/contracts/team-cluster';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';
import { z } from 'zod/v4';
import type { Request, Response } from 'express';
import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';

const daemonGrantSchema = z.object({
    ownerClusterId: z.string().trim().min(1),
    exposureName: z.string().trim().min(1),
    accessMode: z.enum([
        TeamClusterServiceExposureAccessMode.Http,
        TeamClusterServiceExposureAccessMode.Tcp,
        TeamClusterServiceExposureAccessMode.WebSocket
    ])
}).strict();

const service = (): TeamClusterDirectAccessGrantService => {
    return container.resolve(TeamClusterDirectAccessGrantService);
};

const readHeader = (request: Request, headerName: string): string | undefined => {
    const value = request.header(headerName);
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
};

const sendError = (response: Response, error: unknown): void => {
    const message = error instanceof Error ? error.message : 'Unexpected direct access error';
    const code = error instanceof Error && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'TeamCluster::DirectAccessFailed';
    const statusCode = typeof error === 'object'
        && error !== null
        && 'statusCode' in error
        && typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;

    response.status(statusCode).json({
        status: 'error',
        code,
        message
    });
};

export default createHttpModule({
    basePath: TEAM_CLUSTER_DIRECT_ACCESS_BASE_PATH,
    routes: (router) => {
        router.post('/grants', async (request, response) => {
            try {
                const requesterClusterId = readHeader(request, TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER);
                const daemonPassword = readHeader(request, TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER);
                if (!requesterClusterId || !daemonPassword) {
                    throw new Error('Daemon authentication headers are required');
                }

                const parsed = daemonGrantSchema.safeParse(request.body);
                if (!parsed.success) {
                    throw new Error(parsed.error.issues.map((issue) => issue.message).join('; '));
                }

                response.json(await service().authorizeDaemonGrant(
                    requesterClusterId,
                    daemonPassword,
                    parsed.data
                ));
            } catch (error) {
                sendError(response, error);
            }
        });
    }
});
