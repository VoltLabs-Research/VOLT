import type { IMemberContentCounter, MemberContentCountResult } from '@shared/contracts/ports';
import Whiteboard from '@modules/whiteboards/models/Whiteboard';

const COUNT_KEY = 'whiteboardsCount';

interface WhiteboardCountRow{
    createdBy: string;
    total: string | number;
}

class WhiteboardMemberContentCounter implements IMemberContentCounter{
    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult>{
        const counts = new Map<string, number>();
        if(userIds.length === 0){
            return {
                key: COUNT_KEY,
                counts
            };
        }

        const rows = await Whiteboard.createQueryBuilder('w')
            .select('w.createdBy', 'createdBy')
            .addSelect('COUNT(w.id)', 'total')
            .where('w.team = :teamId', { teamId })
            .andWhere('w.createdBy IN (:...userIds)', { userIds })
            .groupBy('w.createdBy')
            .getRawMany<WhiteboardCountRow>();

        for(const row of rows){
            counts.set(String(row.createdBy), Number(row.total));
        }

        return {
            key: COUNT_KEY,
            counts
        };
    }
}

export default new WhiteboardMemberContentCounter();
