import VoltClient from '@/api';
import type { ActivityData } from './types';

const client = new VoltClient('/daily-activity', { useRBAC: true });

const dailyActivityApi = {
    async getTeamActivity(range: number = 365, userId?: string): Promise<ActivityData[]> {
        let url = `/?range=${range}`;
        if (userId) {
            url += `&userId=${userId}`;
        }
        const response = await client.request<{ status: string; data: ActivityData[] }>('get', url);
        return response.data.data;
    }
};

export default dailyActivityApi;