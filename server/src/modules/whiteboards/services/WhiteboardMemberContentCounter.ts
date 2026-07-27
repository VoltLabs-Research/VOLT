import type { IMemberContentCounter, MemberContentCountResult } from '@shared/contracts/ports';
import WhiteboardModel from '@modules/whiteboards/models/WhiteboardModel';
import mongoose from 'mongoose';

class WhiteboardMemberContentCounter implements IMemberContentCounter {
    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult> {
        const userObjectIds = userIds.map((id) => new mongoose.Types.ObjectId(id));
        const results = await WhiteboardModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
            { $match: { team: new mongoose.Types.ObjectId(teamId), createdBy: { $in: userObjectIds } } },
            { $group: { _id: '$createdBy', count: { $sum: 1 } } }
        ]);

        const counts = new Map<string, number>();
        for (const row of results) {
            counts.set(String(row._id), row.count);
        }

        return { key: 'whiteboardsCount', counts };
    }
}

export default new WhiteboardMemberContentCounter();
