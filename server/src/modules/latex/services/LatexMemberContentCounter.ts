import type { IMemberContentCounter, MemberContentCountResult } from '@shared/contracts/ports';
import LatexDocument from '@modules/latex/models/LatexDocument';

interface GroupedCountRow{
    createdBy: string;
    count: number | string;
}

class LatexMemberContentCounter implements IMemberContentCounter{
    async countForTeamMembers(teamId: string, userIds: string[]): Promise<MemberContentCountResult>{
        const rows = await LatexDocument.createQueryBuilder('document')
            .select('document.createdBy', 'createdBy')
            .addSelect('COUNT(document.id)', 'count')
            .where('document.team = :teamId', { teamId })
            .andWhere('document.createdBy IN (:...userIds)', { userIds })
            .groupBy('document.createdBy')
            .getRawMany<GroupedCountRow>();

        const counts = new Map<string, number>();
        for(const row of rows){
            counts.set(String(row.createdBy), Number(row.count));
        }

        return {
            key: 'latexCount',
            counts
        };
    }
}

export default new LatexMemberContentCounter();
