export type ActivityType = 'trajectory-upload' | 'trajectory-deletion' | 'analysis-performed';

export interface ActivityItem {
    type: ActivityType;
    createdAt: string;
    description: string;
};

export interface PopulatedUser {
    _id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
};

export interface DailyActivity {
    _id: string;
    team: string;
    user: string | PopulatedUser;
    date: string;
    activity: ActivityItem[];
    minutesOnline: number;
};
