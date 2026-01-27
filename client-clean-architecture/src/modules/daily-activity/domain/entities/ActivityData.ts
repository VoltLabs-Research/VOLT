export interface ActivityItem {
    type: 'TRAJECTORY_UPLOAD' | 'TRAJECTORY_DELETION' | 'ANALYSIS_PERFORMED';
    user: string;
    createdAt: string;
    description: string;
}

export interface ActivityData {
    date: string;
    activity: ActivityItem[];
    minutesOnline: number;
}
