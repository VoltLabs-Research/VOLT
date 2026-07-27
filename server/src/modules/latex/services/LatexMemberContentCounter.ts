import type { IMemberContentCounter, MemberContentCountResult } from '@shared/contracts/ports';
import LatexDocumentModel from '@modules/latex/models/LatexDocumentModel';

interface GroupedCountRow {
    _id: unknown;
    count: number;
}

class LatexMemberContentCounter implements IMemberContentCounter {
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

export default new LatexMemberContentCounter();
