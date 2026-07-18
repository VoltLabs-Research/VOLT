import type { AtomPageResult } from '@modules/trajectory/contracts/trajectory';

export interface ITrajectoryReader {
    readPage(
        teamClusterId: string | undefined,
        trajectoryId: string,
        timestep: string | number,
        page: number,
        limit: number,
        analysisId?: string,
        ownerClusterId?: string
    ): Promise<AtomPageResult>;
}
