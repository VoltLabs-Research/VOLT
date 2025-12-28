import VoltClient from '@/api';
import type { ActivityData } from './types';

const client = new VoltClient('/daily-activity', { useRBAC: true });

const dailyActivityApi = {
    async getTeamActivity(range: number = 365): Promise<ActivityData[]>{
        const response = await client.request<{ status: string; data: ActivityData[] }>('get', `/?range=${range}`);
        return response.data.data;
    }
};

export default dailyActivityApi;