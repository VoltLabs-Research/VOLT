import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';

import type { AtomPageResult } from '@modules/trajectory/contracts/trajectory';
import trajectoryNativeDaemonService from '@modules/trajectory/services/native/TrajectoryNativeDaemonService';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';

export class TrajectoryReader {
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

        return trajectoryNativeDaemonService.getAtomsPage({
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

export default new TrajectoryReader();
