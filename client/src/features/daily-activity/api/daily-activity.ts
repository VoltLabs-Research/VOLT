import VoltClient, { getTeamId } from '@/api';
import type { ActivityData } from '@/features/daily-activity/types';
import type { ApiResponse } from '@/types/api';

const client = new VoltClient('/daily-activity', { useRBAC: false });

const dailyActivityApi = {
    async getTeamActivity(range: number = 365, userId?: string): Promise<ActivityData[]> {
        const teamId = getTeamId();
        let url = `/${teamId}/?range=${range}`; // Backend: router.get('/:teamId/', ...) so /:teamId/ is correct
        if (userId) {
            url += `&userId=${userId}`;
        }
        const response = await client.request<ApiResponse<ActivityData[]>>('get', url);
        return response.data.data;
    }
};

export default dailyActivityApi;