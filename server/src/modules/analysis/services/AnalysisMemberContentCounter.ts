import type { IMemberContentCounter, MemberContentCountResult } from '@shared/contracts/ports';
import Analysis from '@modules/analysis/models/Analysis';

const COUNT_KEY = 'analysesCount';

interface GroupedCountRow{
    createdBy: string;
    count: string | number;
}

class AnalysisMemberContentCounter implements IMemberContentCounter{
    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult>{
        const counts = new Map<string, number>();
        if(userIds.length === 0){
            return {
                key: COUNT_KEY,
                counts
            };
        }

        const rows = await Analysis.createQueryBuilder('analysis')
            .select('analysis.createdBy', 'createdBy')
            .addSelect('COUNT(analysis.id)', 'count')
            .where('analysis.team = :teamId', { teamId })
            .andWhere('analysis.createdBy IN (:...userIds)', { userIds })
            .groupBy('analysis.createdBy')
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

export default new AnalysisMemberContentCounter();
