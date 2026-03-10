import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { IRasterJobEnqueuer } from '@modules/raster/domain/port/IRasterJobEnqueuer';
import type { IRasterStorage } from '@modules/raster/domain/port/IRasterStorage';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

@injectable()
export class RasterJobEnqueuerService implements IRasterJobEnqueuer {
    constructor(
        @inject(RASTER_TOKENS.RasterStorage)
        private readonly rasterStorage: IRasterStorage,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async triggerRasterization(trajectoryId: string, teamId: string, _config?: unknown): Promise<boolean> {
        const teamCluster = await this.resolveTeamCluster(teamId);
        if (!teamCluster) {
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Rasterization requires a connected team cluster',
                409
            );
        }

        const glbFiles: string[] = [];

        try {
            for await (const file of this.rasterStorage.listModelFiles(trajectoryId)) {
                if (file.endsWith('.glb')) {
                    glbFiles.push(file);
                }
            }
        } catch (error) {
            logger.warn(error, `Failed to list GLB files for trajectory ${trajectoryId}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to list GLB files for rasterization',
                500
            );
        }

        if (glbFiles.length === 0) {
            return false;
        }

        try {
            await this.teamClusterDaemonClient.request<{ triggered: boolean }>(teamCluster, '/api/orchestration/rasterize', {
                method: 'POST',
                body: {
                    trajectoryId
                }
            });
            return true;
        } catch (error) {
            logger.warn(error, `Failed to queue rasterization jobs for trajectory ${trajectoryId}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to queue rasterization jobs',
                500
            );
        }
    }

    private async resolveTeamCluster(teamId: string): Promise<string | null> {
        const teamCluster = await this.teamClusterRepository.findOne({
            team: teamId
        } as Record<string, unknown>);

        return teamCluster ? teamCluster.id : null;
    }
};
