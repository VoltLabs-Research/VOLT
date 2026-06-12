import { MEMBER_CONTENT_COUNTER_TOKEN } from '@shared/contracts/tokens/CollectionTokens';
import type { IMemberContentCounter, MemberContentCountResult } from '@shared/contracts/ports';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import { inject } from 'tsyringe';

/**
 * Contributes the per-member `whiteboardsCount` to the team-member listing via
 * the neutral MEMBER_CONTENT_COUNTER collection (detachable-modules migration).
 * Team no longer imports the whiteboard repository directly; disabling
 * whiteboards drops this counter and the metric is absent.
 */
@CollectionMember(MEMBER_CONTENT_COUNTER_TOKEN)
export class WhiteboardMemberContentCounter implements IMemberContentCounter {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository) private readonly whiteboardRepository: IWhiteboardRepository
    ) {}

    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult> {
        const counts = await this.whiteboardRepository.countGroupedBy('createdBy', userIds, { team: teamId });
        return { key: 'whiteboardsCount', counts };
    }
}
