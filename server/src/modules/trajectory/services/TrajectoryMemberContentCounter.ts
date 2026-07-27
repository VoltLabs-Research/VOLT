import type { IMemberContentCounter, MemberContentCountResult } from '@shared/contracts/ports';

import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';

interface GroupedCountResult {
    _id: { toString(): string };
    count: number;
}

class TrajectoryMemberContentCounter implements IMemberContentCounter {
    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult> {
        const results = await TrajectoryModel.aggregate<GroupedCountResult>([
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

        return { key: 'trajectoriesCount', counts };
    }
}

export default new TrajectoryMemberContentCounter();
