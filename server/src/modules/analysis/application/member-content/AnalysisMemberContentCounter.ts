import { MEMBER_CONTENT_COUNTER_TOKEN } from '@shared/contracts/tokens/CollectionTokens';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type { IMemberContentCounter, MemberContentCountResult, IAnalysisRepository } from '@shared/contracts/ports';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * Contributes the per-member `analysesCount` to the team-member listing via the
 * neutral MEMBER_CONTENT_COUNTER collection (detachable-modules migration). Team
 * no longer injects the analysis repository directly; disabling analysis drops
 * this counter and the metric is treated as 0.
 */
@CollectionMember(MEMBER_CONTENT_COUNTER_TOKEN)
export class AnalysisMemberContentCounter implements IMemberContentCounter {
    constructor(
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository
    ) {}

    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult> {
        const counts = await this.analysisRepository.countGroupedBy('createdBy', userIds, { team: teamId });
        return { key: 'analysesCount', counts };
    }
}
