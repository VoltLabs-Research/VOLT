import type {
    IMemberContentCounter,
    MemberContentCountResult
} from '@shared/contracts/ports/IMemberContentCounter';
import Trajectory from '@modules/trajectory/models/Trajectory';

const COUNT_KEY = 'trajectoriesCount';

interface GroupedCountRow{
    createdBy: string;
    count: string | number;
}

class TrajectoryMemberContentCounter implements IMemberContentCounter{
    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult>{
        const counts = new Map<string, number>();
        if(userIds.length === 0){
            return {
                key: COUNT_KEY,
                counts
            };
        }

        const rows = await Trajectory.createQueryBuilder('trajectory')
            .select('trajectory.createdBy', 'createdBy')
            .addSelect('COUNT(trajectory.id)', 'count')
            .where('trajectory.team = :teamId', { teamId })
            .andWhere('trajectory.createdBy IN (:...userIds)', { userIds })
            .groupBy('trajectory.createdBy')
            .getRawMany<GroupedCountRow>();

        for(const row of rows){
            counts.set(row.createdBy, Number(row.count));
        }

        return {
            key: COUNT_KEY,
            counts
        };
    }
}

export default new TrajectoryMemberContentCounter();
