import { MEMBER_CONTENT_COUNTER_TOKEN } from '@shared/contracts/tokens/CollectionTokens';
import type { IMemberContentCounter, MemberContentCountResult } from '@shared/contracts/ports';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import WhiteboardModel from '@modules/whiteboards/models/WhiteboardModel';
import mongoose from 'mongoose';

/**
 * Contributes the per-member `whiteboardsCount` to the team-member listing via
 * the neutral MEMBER_CONTENT_COUNTER collection (detachable-modules migration).
 * Counts straight off the Mongoose {@link WhiteboardModel} (no repository);
 * disabling whiteboards drops this counter and the metric is absent.
 */
@CollectionMember(MEMBER_CONTENT_COUNTER_TOKEN)
export class WhiteboardMemberContentCounter implements IMemberContentCounter {
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
