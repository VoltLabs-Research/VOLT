import VoltClient from '@/api';
import dailyActivityApi from '../daily-activity/daily-activity';
import trajectoryApi from '../trajectory/trajectory';

const client = new VoltClient('/team-member', { useRBAC: true });

export default {
    async update(memberId: string, data: any): Promise<any>{
        const response = await client.request('patch', `/${memberId}`, { data });
        return response.data.data;
    },

    async getAll(): Promise<any>{
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
            
            const dailyActivities = await dailyActivityApi.getTeamActivity(7);
            const minutesOnline = dailyActivities.reduce((acc, curr) => acc + (curr.minutesOnline || 0), 0);
            const trajectories = await trajectoryApi.getAllPaginated({ createdBy: userId, limit: 0 });
            console.log('DAily Activities', dailyActivities)
            return {
                ...member,
                timeSpentLast7Days: minutesOnline,
                trajectoriesCount: trajectories.results.total,
                analysesCount: 0
            };
        }));

        const ownerMember = memberStats.find((member: any) => member.role?.name === 'Owner');
        const adminMembers = memberStats.find((member: any) => member.role?.name === 'Admin') ?? [];

        return {
            members: memberStats,
            admins: adminMembers,
            owner: ownerMember
        }
    }
};