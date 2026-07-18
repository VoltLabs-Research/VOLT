import { MEMBER_CONTENT_COUNTER_TOKEN } from '@shared/contracts/tokens/CollectionTokens';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type { IMemberContentCounter, MemberContentCountResult, IAnalysisRepository } from '@shared/contracts/ports';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { container as diContainer } from 'tsyringe';

@CollectionMember(MEMBER_CONTENT_COUNTER_TOKEN)
export class AnalysisMemberContentCounter implements IMemberContentCounter {
    #analysisRepositoryCache?: IAnalysisRepository;
    private get analysisRepository(): IAnalysisRepository {
        return (this.#analysisRepositoryCache ??= diContainer.resolve<IAnalysisRepository>(COMPUTE_TOKENS.AnalysisRepository));
    }

    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult> {
        const counts = await this.analysisRepository.countGroupedBy('createdBy', userIds, { team: teamId });
        return { key: 'analysesCount', counts };
    }
}
