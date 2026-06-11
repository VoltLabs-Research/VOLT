import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';


import type { AtomPageResult } from '@modules/trajectory/domain/contracts/trajectory';
import type { ITrajectoryReader } from '@modules/trajectory/domain/port/trajectory/ITrajectoryReader';
import type { ITrajectoryNativeDaemonService } from '@modules/trajectory/domain/port/native/ITrajectoryNativeDaemonService';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';

@Singleton(TRAJECTORY_TOKENS.TrajectoryReader)
export default class TrajectoryReader implements ITrajectoryReader {
    constructor(

        @inject(TRAJECTORY_TOKENS.TrajectoryNativeDaemonService)
        private readonly trajectoryNativeDaemonService: ITrajectoryNativeDaemonService
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
        return buildTrajectoryDumpObjectName(trajectoryId, timestep);
    }
}
