import { MEMBER_CONTENT_COUNTER_TOKEN } from '@shared/contracts/tokens/CollectionTokens';
import type { IMemberContentCounter, MemberContentCountResult } from '@shared/contracts/ports';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import LatexDocumentModel from '@modules/latex/models/LatexDocumentModel';

interface GroupedCountRow {
    _id: unknown;
    count: number;
}

@CollectionMember(MEMBER_CONTENT_COUNTER_TOKEN)
export class LatexMemberContentCounter implements IMemberContentCounter {
    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult> {
        const rows = await LatexDocumentModel.aggregate<GroupedCountRow>([
            { $match: { team: teamId, createdBy: { $in: userIds } } },
            { $group: { _id: '$createdBy', count: { $sum: 1 } } }
        ]);

        const counts = new Map<string, number>();
        for (const row of rows) {
            counts.set(String(row._id), row.count);
        }

        return { key: 'latexCount', counts };
    }
}
