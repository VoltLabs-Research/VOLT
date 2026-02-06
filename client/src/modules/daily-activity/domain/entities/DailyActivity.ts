export type ActivityType = 'trajectory-upload' | 'trajectory-deletion' | 'analysis-performed';

export interface ActivityItem {
    type: ActivityType;
    createdAt: string;
    description: string;
};

export interface DailyActivity {
    team: string;
    user: string;
    date: string;
    activity: ActivityItem[];
    minutesOnline: number;
};
