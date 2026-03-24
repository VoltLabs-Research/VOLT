import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { inject, injectable } from 'tsyringe';

import type { ITrajectoryReader } from '@modules/trajectory/domain/port/trajectory/ITrajectoryReader';
import type { AtomPageResult } from '@modules/trajectory/domain/contracts/trajectory';
import type TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';

@injectable()
export default class TrajectoryReader implements ITrajectoryReader {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryNativeDaemonService)
        private readonly trajectoryNativeDaemonService: TrajectoryNativeDaemonService
    ) {}

    async readPage(
        teamClusterId: string | undefined,
        trajectoryId: string,
        timestep: string | number,
        page: number,
        limit: number,
        analysisId?: string,
        ownerClusterId?: string
    ): Promise<AtomPageResult> {
        if (!teamClusterId) {
            throw ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_TEAM_CLUSTER_REQUIRED,
                `Trajectory ${trajectoryId} must be associated with a team cluster to read atoms`
            );
        }

        return this.trajectoryNativeDaemonService.getAtomsPage({
            teamClusterId,
            trajectoryId,
            timestep,
            objectKey: this.getDumpObjectKey(trajectoryId, timestep),
            ownerClusterId,
            page,
            limit,
            analysisId
        });
    }

    private getDumpObjectKey(trajectoryId: string, timestep: string | number): string {
        return `trajectory-${trajectoryId}/timestep-${timestep}.dump.gz`;
    }
}
