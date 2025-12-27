import api from '@/api';

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
    async getTeamActivity(teamId: string, range: number = 365): Promise<ActivityData[]>{
        const response = await api.get<{ status: string; data: ActivityData[] }>(`/daily-activity/team/${teamId}?range=${range}`);
        return response.data.data;
    }
};

export default dailyActivityApi;