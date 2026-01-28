import VoltClient, { getTeamId } from '@/api';

const client = new VoltClient('/team/members', { useRBAC: false });

export default {
    async update(memberId: string, data: any): Promise<any> {
        // Update route: /:teamId/:teamMemberId
        const teamId = getTeamId();
        const response = await client.request('patch', `/${teamId}/${memberId}`, { data });
        return response.data.data;
    },

    async getAll(): Promise<any[]> {
        const teamId = getTeamId();
        const response = await client.request('get', `/${teamId}`);
        const result = response.data.data;
        return result.data;
    }
};