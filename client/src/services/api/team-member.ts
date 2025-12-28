import VoltClient from '@/api';
import { getCurrentTeamId as getTeamId } from '@/stores/team/team';

const client = new VoltClient('/team-member', { useRBAC: true, getTeamId });

export default {
    async update(memberId: string, data: any): Promise<any>{
        const response = await client.request('patch', `/${memberId}`, { data });
        return response.data.data;
    }
};