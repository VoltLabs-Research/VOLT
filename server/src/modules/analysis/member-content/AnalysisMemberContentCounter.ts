import type { IMemberContentCounter, MemberContentCountResult } from '@shared/contracts/ports';
import AnalysisModel from '@modules/analysis/models/AnalysisModel';

interface GroupedCountResult {
    _id: string;
    count: number;
}

class AnalysisMemberContentCounter implements IMemberContentCounter {
    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult> {
        const results = await AnalysisModel.aggregate<GroupedCountResult>([
            {
                $match: {
                    team: teamId,
                    createdBy: { $in: userIds }
                }
            },
            {
                $group: {
                    _id: '$createdBy',
                    count: { $sum: 1 }
                }
            }
        ]);

        const counts = new Map<string, number>();
        for (const row of results) {
            counts.set(row._id.toString(), row.count);
        }

        return { key: 'analysesCount', counts };
    }
}

export default new AnalysisMemberContentCounter();
