import VoltClient from '@/api';

const client = new VoltClient('/daily-activity', { useRBAC: true });

export interface ActivityItem{
    type: 'TRAJECTORY_UPLOAD' | 'TRAJECTORY_DELETION' | 'ANALYSIS_PERFORMED';
    user: string;
    createdAt: string;
    description: string;
};

export interface ActivityData{
    date: string;
    activity: ActivityItem[];
    minutesOnline: number;
};

const dailyActivityApi = {
    async getTeamActivity(range: number = 365): Promise<ActivityData[]>{
        const response = await client.request<{ status: string; data: ActivityData[] }>('get', `/?range=${range}`);
        return response.data.data;
    }
};

export default dailyActivityApi;