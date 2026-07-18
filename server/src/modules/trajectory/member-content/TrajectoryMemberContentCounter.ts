import { MEMBER_CONTENT_COUNTER_TOKEN } from '@shared/contracts/tokens/CollectionTokens';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type { IMemberContentCounter, MemberContentCountResult, ITrajectoryRepository } from '@shared/contracts/ports';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * Contributes the per-member `trajectoriesCount` to the team-member listing via
 * the neutral MEMBER_CONTENT_COUNTER collection (detachable-modules migration).
 * Team no longer injects the trajectory repository directly; disabling trajectory
 * drops this counter and the metric is treated as 0.
 */
@CollectionMember(MEMBER_CONTENT_COUNTER_TOKEN)
export class TrajectoryMemberContentCounter implements IMemberContentCounter {
    constructor(
        @inject(COMPUTE_TOKENS.TrajectoryRepository) private readonly trajectoryRepository: ITrajectoryRepository
    ) {}

    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult> {
        const counts = await this.trajectoryRepository.countGroupedBy('createdBy', userIds, { team: teamId });
        return { key: 'trajectoriesCount', counts };
    }
}
