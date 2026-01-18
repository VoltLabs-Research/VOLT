import VoltClient, { getTeamId } from '@/api';

const client = new VoltClient('/team/members', { useRBAC: false });

export default {
    async update(memberId: string, data: any): Promise<any> {
        // Update route: /:teamId/:teamMemberId
        const teamId = getTeamId();
        const response = await client.request('patch', `/${teamId}/${memberId}`, { data });
        return response.data.data;
    },

    async getAll(): Promise<any> {
        const teamId = getTeamId();
        const response = await client.request('get', `/${teamId}`);
        // Backend returns { status, data: { data: TeamMemberStatsProps[], page, limit, total } }
        const result = response.data.data;
        const memberStats = result.data;

        const ownerMember = memberStats.find((member: any) => member.role?.name === 'Owner');
        const adminMembers = memberStats.filter((member: any) => member.role?.name === 'Admin') ?? [];

        return {
            members: memberStats,
            admins: adminMembers,
            owner: ownerMember
        }
    }
};