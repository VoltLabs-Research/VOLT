import { MEMBER_CONTENT_COUNTER_TOKEN } from '@shared/contracts/tokens/CollectionTokens';
import type { IMemberContentCounter, MemberContentCountResult } from '@shared/contracts/ports';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import { inject } from 'tsyringe';

/**
 * Contributes the per-member `latexCount` to the team-member listing via the
 * neutral MEMBER_CONTENT_COUNTER collection (detachable-modules migration). The
 * team module no longer imports the latex repository directly; when latex is
 * disabled this counter isn't registered and the metric is simply absent.
 */
@CollectionMember(MEMBER_CONTENT_COUNTER_TOKEN)
export class LatexMemberContentCounter implements IMemberContentCounter {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository
    ) {}

    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult> {
        const counts = await this.latexDocumentRepository.countGroupedBy('createdBy', userIds, { team: teamId });
        return { key: 'latexCount', counts };
    }
}
