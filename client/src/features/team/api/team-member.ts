import VoltClient from '@/api';
import dailyActivityApi from '@/features/daily-activity/api/daily-activity';
import trajectoryApi from '@/features/trajectory/api/trajectory';
import analysis from '@/features/analysis/api/analysis';

const client = new VoltClient('/team-member', { useRBAC: true });

export default {
    async update(memberId: string, data: any): Promise<any> {
        const response = await client.request('patch', `/${memberId}`, { data });
        return response.data.data;
    },

    async getAll(): Promise<any> {
        const params = {
            populate: [
                { path: 'role', select: 'name permissions isSystem' },
                { path: 'user', select: 'email avatar firstName lastName lastLoginAt createdAt' }
            ]
        };
        const response = await client.request('get', '/', { query: params });

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const memberStats = await Promise.all(response.data.data.map(async (member: any) => {
            const userId = member.user._id;

            const [dailyActivities, trajectoriesCount, analysesCount] = await Promise.all([
                dailyActivityApi.getTeamActivity(7, userId),
                trajectoryApi.getAllPaginated({ createdBy: userId, countDocuments: true } as any),
                analysis.getByTeamId({ q: userId, countDocuments: true } as any)
            ]);

            const minutesOnline = dailyActivities.reduce((acc, curr) => acc + (curr.minutesOnline || 0), 0);

            return {
                ...member,
                timeSpentLast7Days: minutesOnline,
                trajectoriesCount: trajectoriesCount.total,
                analysesCount: analysesCount.total
            };
        }));

        const ownerMember = memberStats.find((member: any) => member.role?.name === 'Owner');
        const adminMembers = memberStats.filter((member: any) => member.role?.name === 'Admin') ?? [];

        return {
            members: memberStats,
            admins: adminMembers,
            owner: ownerMember
        }
    }
};