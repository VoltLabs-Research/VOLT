import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type { IMemberContentCounter, MemberContentCountResult, IAnalysisRepository } from '@shared/contracts/ports';
import { container as diContainer } from 'tsyringe';

class AnalysisMemberContentCounter implements IMemberContentCounter {
    #analysisRepositoryCache?: IAnalysisRepository;
    private get analysisRepository(): IAnalysisRepository {
        return (this.#analysisRepositoryCache ??= diContainer.resolve<IAnalysisRepository>(COMPUTE_TOKENS.AnalysisRepository));
    }

    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult> {
        const counts = await this.analysisRepository.countGroupedBy('createdBy', userIds, { team: teamId });
        return { key: 'analysesCount', counts };
    }
}

export default new AnalysisMemberContentCounter();
